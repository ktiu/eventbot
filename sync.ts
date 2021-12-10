import axios from 'axios'
import { createWriteStream, readFileSync } from 'fs'

const path = require('path')
const yaml = require('yaml')

interface Subscription {
  name: string
  url: string
}

const subscriptionsFile: string = path.join(__dirname, 'subscriptions.yaml')
const subscriptions: Subscription[] = yaml.parse(readFileSync(subscriptionsFile, 'utf8'))

const syncCache = (subscription: Subscription): void => {
  axios({
    url: subscription.url,
    method: 'GET',
    responseType: 'stream'
  }).then((response) => {
    response.data.pipe(createWriteStream(
      path.join(__dirname, `cache/${subscription.name}.ics`)
    ))
  }).catch(function(error) {
    if (error.response) {
      console.log(error.response.data);
      console.log(error.response.status);
      console.log(error.response.headers);
    } else if (error.request) {
      console.log(error.request);
    } else {
      console.log('Error', error.message);
    }
  });
}

subscriptions.forEach(s => syncCache(s))
