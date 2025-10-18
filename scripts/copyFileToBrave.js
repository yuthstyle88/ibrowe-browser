const path = require('path')
const copyFileToBravePath = path.resolve(__dirname, '..', 'src', 'ibrowe', 'scripts', 'copyFileToBrave.js')
const { copyFileToBrave } = require(copyFileToBravePath)
console.log('Running copyFileToBrave')

copyFileToBrave()