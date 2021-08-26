require('dotenv').config()

const { exec } = require('child_process')
const { promisify } = require('util')
const fs = require('fs')
const { join } = require('path')

const existsAsync = promisify(fs.exists)
const fse = require('fs-extra')

const execCommand = promisify(exec)

async function deleteFile (filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

async function compileContract ({
  contract,
  path
}) {

  const compiled = join(__dirname, '../compiled')
  let cmd = ""
  
  if (process.env.COMPILER === 'local') {
    cmd = `eosio-cpp -abigen -I ./include -contract ${contract} -o ./compiled/${contract}.wasm ${path}`
  } else {
    cmd = `docker run --rm --name eosio.cdt_v1.7.0-rc1 --volume ${join(__dirname, '../')}:/project -w /project eostudio/eosio.cdt:v1.7.0-rc1 /bin/bash -c "echo 'starting';eosio-cpp -abigen -I ./include -contract ${contract} -o ./compiled/${contract}.wasm ${path}"`
  }
  console.log("compiler command: " + cmd, '\n')

  if (!fs.existsSync(compiled)) {
    fs.mkdirSync(compiled)
  }

  await deleteFile(join(compiled, `${contract}.wasm`))
  await deleteFile(join(compiled, `${contract}.abi`))

  // Download document-graph
  // await execCommand('git submodule init')
  // await execCommand('git submodule update')

  // copy document-graph submodule to the project's paths
  const docGraphInclude = 'include/document_graph'
  const docGraphIncludeLogger = 'include/logger'
  const docGraphSrc = 'src/document_graph'

  const docGraphIncludeFound = await existsAsync(docGraphInclude)
  const docGraphSrcFound = await existsAsync(docGraphSrc)
  const docGraphIncludeLoggerFound = await existsAsync(docGraphIncludeLogger)

  if (!docGraphIncludeFound) {
    fse.copySync('document-graph/include/document_graph', docGraphInclude, { overwrite: true }, (err) => {
      if (err) {
        throw new Error(''+err)
      } else {
        console.log("document graph submodule include prepared")
      }
    })
  }

  if (!docGraphIncludeLoggerFound) {
    fse.copySync('document-graph/include/logger', docGraphIncludeLogger, { overwrite: true }, (err) => {
      if (err) {
        throw new Error(''+err)
      } else {
        console.log("document graph submodule include prepared")
      }
    })
  }

  if (!docGraphSrcFound) {
    fse.copySync('document-graph/src/document_graph', docGraphSrc, { overwrite: true }, (err) => {
      if (err) {
        throw new Error(''+err)
      } else {
        console.log("document graph submodule src prepared")
      }
    })
  }

  await execCommand(cmd)

}

module.exports = { compileContract }
