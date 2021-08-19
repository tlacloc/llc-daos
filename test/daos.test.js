const assert = require('assert')
const { rpc } = require('../scripts/eos')
const { getContracts, getAccountBalance } = require('../scripts/eosio-util')
const { daosAccounts } = require('../scripts/daos-util')
const { assertError } = require('../scripts/eosio-errors')
const { contractNames, isLocalNode, sleep } = require('../scripts/config')
const { setParamsValue } = require('../scripts/contract-settings')

const { daos } = contractNames
const { firstuser, seconduser, thirduser, fourthuser } = daosAccounts

describe('daos', async function () {

  it('Should pass', async () => {
    assert.deepStrictEqual(true, true)
  })

})
