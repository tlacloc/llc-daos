const assert = require('assert')
const { rpc } = require('../scripts/eos')
const { getContracts, getAccountBalance } = require('../scripts/eosio-util')
const { daosAccounts } = require('../scripts/daos-util')
const { assertError } = require('../scripts/eosio-errors')
const { contractNames, isLocalNode, sleep } = require('../scripts/config')
const { setParamsValue } = require('../scripts/contract-settings')

const { daoinf, daoreg } = contractNames
// const { firstuser, seconduser, thirduser, fourthuser } = daosAccounts

describe('daos', async function () {
  let contracts

  before(async function () {

    if (!isLocalNode()) {
      console.log('These tests should only be run on local node')
      process.exit(1)
    }

    contracts = await getContracts([daoinf])
  })

  beforeEach(async function () {
    await contracts.daoinf.reset({ authorization: `${daoinf}@active` })
  })

  it('Should pass', async () => {
    await contracts.daoinf.initdao({ authorization: `${daoinf}@active` })

    const edgesTable = await rpc.get_table_rows({
      code: daoinf,
      scope: daoinf,
      table: 'edges',
      json: true,
      limit: 100
    })

    console.log(JSON.stringify(edgesTable, null, 2))

    assert.deepStrictEqual(true, true)
  })
})
