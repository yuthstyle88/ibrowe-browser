const path = require('path')
const copyFileToBravePath = path.resolve(__dirname, '..', 'src', 'ibrowe', 'scripts', 'copyFileToBrave.js')
const { copyFileToiBrowe } = require(copyFileToBravePath)
console.log('Running copyFileToBrave')

copyFileToiBrowe()