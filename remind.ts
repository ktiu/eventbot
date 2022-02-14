import axios from 'axios'
import { readFileSync } from 'fs'
import ical = require('node-ical')
import { Moment } from 'moment'
import moment from 'moment'
moment.locale('de')
import escape from 'markdown-escape'
import path from 'path'
import yaml from 'yaml'
const store = require('data-store')({
  path: path.join(__dirname, 'remember.json')
})


const subscriptionsFile: string = path.join(__dirname, 'subscriptions.yaml')
const subscriptions: Subscription[] = yaml.parse(readFileSync(subscriptionsFile, 'utf8'))

const configFile = path.join(__dirname, 'config.yaml')
const config = yaml.parse(readFileSync(configFile, 'utf8'))

interface Subscription {
  name: string
  channels: string[]
}

class showEvent {
  summary: string
  start: Moment
  end: Moment
  allDay: boolean = false
  location?: string
  description?: string
  url?: string
  rememberBy(): string {
    return `${this.summary} ${this.start}`
  }

  constructor(event: any, startDate: Moment, endDate: Moment) {
    this.summary = (typeof (event.summary) === "string")
      ? event.summary : event.summary.val
    if (event.url) {
      this.url = (typeof (event.url) === "string")
        ? event.url : event.url.val
    }
    if (event.location) {
      this.location = (typeof (event.location) === "string")
        ? event.location : event.location.val
    }
    if (event.description) {
      this.description = (typeof (event.description) === "string")
        ? event.description : event.description.val
    }
    this.start = startDate
    this.end = endDate
  }
}

const process = (event: showEvent, subscription: Subscription): void => {
  let message = [
    `**${escape(event.summary, ['slashes'])}**`,
    `${event.start.format("H:mm")}–${event.end.format("H:mm")}` +
    (event.location ? ` | ${escape(event.location, ['slashes'])}` : '') +
    (event.url ? ` | ${event.url}` : '') +
    (event.description ? `\n\n${escape(event.description, ['slashes'])}`: ''),
    `\n*Dieser Termin begint ${event.start.fromNow()}.*`
  ].join('\n')

  subscription.channels.forEach(channel => {
    if (! config.production) {
      channel == "bot-sandbox"
    }
    let remembered = store.get(channel) || []
    if (remembered.includes(event.rememberBy())) {
      return
    }
    if (config.log) {
      console.log(channel, message)
      if (config.save) {
        store.union(channel, event.rememberBy())
      }
    }
    if (config.post) {
      axios.post(config.webhookURL, {
        text     :  message,
        channel  :  channel,
        username :  config.username,
        icon_url :  config.iconURL,
      })
      .then(_ => {
        if (config.save) {
          store.union(channel, event.rememberBy())
        }
      })
    }
  })
}

// What period are we even interested in?
const rangeStart = moment().startOf('day')
const rangeEnd = moment(rangeStart).add(3, 'd')

subscriptions.forEach(subscription => {
  const showEvents: showEvent[] = new Array()
  let readEvents = ical.sync.parseFile(
    path.join(__dirname, `cache/${subscription.name}.ics`)
  )
  for (let k in readEvents) {
    if (!Object.prototype.hasOwnProperty.call(readEvents, k)) continue;
    const event = readEvents[k];

    // Metadata or something
    if (event.type !== 'VEVENT') continue

    let startDate = moment(event.start)
    let endDate = moment(event.end)
    let duration: number = parseInt(endDate.format("x"))
      - parseInt(startDate.format("x"))

    let dates: Moment[]

    if (event.rrule) {
      // Get dates of interest within rrule
      dates = event.rrule.between(
        rangeStart.toDate(),
        rangeEnd.toDate(),
        true,
        function(_date, _i) { return true }
      ).map(d => moment(d))


      // Add all manually changed recurrences that were not originally in range
      if (event.recurrences != undefined) {
        for (var r in event.recurrences) {
          if (moment(new Date(r)).isBetween(rangeStart, rangeEnd) != true) {
            dates.push(moment(new Date(r)))
          }
        }
      }


      dates.forEach(date => {
        let curEvent = event
        let showRecurrence = true
        let curDuration = duration
        let startDate = date
        let dateLookupKey = date.toISOString().substring(0, 10)


        if ((curEvent.recurrences != undefined)
          && (curEvent.recurrences[dateLookupKey] != undefined)) {
          // We found an override, so for this recurrence, use a potentially
          // different title, start date, and duration.
          curEvent = curEvent.recurrences[dateLookupKey]
          startDate = moment(curEvent.start)
          curDuration = parseInt(moment(curEvent.end).format("x"))
            - parseInt(startDate.format("x"))
        }

        // remove exceptions
        else if ((curEvent.exdate != undefined) && (curEvent.exdate[dateLookupKey] != undefined)) {
          showRecurrence = false
        }

        // Set the the title and the end date from either the regular event or the recurrence override.
        endDate = moment(parseInt(startDate.format("x")) + curDuration, 'x');

        if (endDate.isBefore(rangeStart) || startDate.isAfter(rangeEnd)) {
          showRecurrence = false
        }

        if (showRecurrence) {
          showEvents.push(new showEvent(curEvent, startDate, endDate))
        }

      })
    } else {
      showEvents.push(new showEvent(event, startDate, endDate))
    }
  }
  showEvents
    .filter(e => e.start.isBetween(moment(), moment().add(15, 'minutes')) )
    .forEach(e => process(e, subscription))
})

