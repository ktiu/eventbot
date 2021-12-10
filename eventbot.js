const path = require('path')
const express = require('express')
const app = express()
const port = 3004

app.get('/eventbot', (_, res) => res.send('Eventbot is running.'))
app.listen(port, () => console.log(`Eventbot listening at http://localhost:${port}`))

app.use('/eventbot/assets', express.static(path.join(__dirname, 'assets')))
