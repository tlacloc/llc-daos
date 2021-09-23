const assert = require('assert')
const { rpc } = require('../scripts/eos')
const { getContracts, getAccountBalance } = require('../scripts/eosio-util')
const { daosAccounts } = require('../scripts/daos-util')
const { assertError } = require('../scripts/eosio-errors')
const { contractNames, isLocalNode, sleep } = require('../scripts/config')
const { setParamsValue } = require('../scripts/contract-settings')

const { daoreg, daoinf } = contractNames
const { firstuser, seconduser, thirduser, fourthuser } = daosAccounts

describe('Dao registry', async function () {

  let contracts;
  let daosUsers;

  before(async function () {

    if (!isLocalNode()) {
      console.log('These tests should only be run on local node')
      process.exit(1)
    }
    contracts = await getContracts([daoreg])
    daosUsers = [firstuser, seconduser, thirduser]
    await setParamsValue()
  })

  beforeEach(async function () {
    await contracts.daoreg.reset({ authorization: `${daoreg}@active` })
  })

  it('Settings, set a new param', async function () {
    await contracts.daoreg.setparam('testparam', ['uint64', 20], 'test param', { authorization: `${daoreg}@active` })

    const settingsParam = await rpc.get_table_rows({
      code: daoreg,
      scope: daoreg,
      table: 'config',
      json: true,
      limit: 100
    })

    console.log(JSON.stringify(settingsParam, null, 2))
  })

  it('Create dao', async () => {
    await contracts.daoreg.create('org1', daoreg, 'HASH', { authorization: `${daoreg}@active` })
    // await contracts.daoreg.create('org2', firstuser, 'HASH', { authorization: `${firstuser}@active` })

    try {
      await contracts.daoreg.create('org1', firstuser, 'HASH', { authorization: `${daoinf}@active` })
    } catch (error) {
      assertError({
        error,
        textInside: `missing authority of testuseraaa`,
        message: 'user must be have authorization (expected)',
        throwError: true
      })
    }

  })

  it('Update dao', async () => {
    // create dao
    await contracts.daoreg.create('org1', daoreg, 'HASH', { authorization: `${daoreg}@active` })

    await contracts.daoreg.update('org1', 'HASH_new', { authorization: `${daoreg}@active` })

    // dao cannot be updated by someone else
    try {
      await contracts.daoreg.update('org1', 'HASH_new2', { authorization: `${daoinf}@active` })
    } catch (error) {
      assertError({
        error,
        textInside: `missing authority of daoregistry`,
        message: 'dao cannot be updated by someone else (expected)',
        throwError: true
      })
    }

  })

  it('Delete dao', async () => {
    // create dao
    await contracts.daoreg.create('org1', daoreg, 'HASH', { authorization: `${daoreg}@active` });
    // await contracts.daoreg.create('org2', firstuser, 'HASH', { authorization: `${firstuser}@active` })

    // delete dao by someone else (no daoreg)
    try {
      await contracts.daoreg.delorg('org1', { authorization: `${daoinf}@active` })
    } catch (error) {
      assertError({
        error,
        textInside: `missing authority of daoregistry`,
        message: 'users can not delete dao (expected)',
        throwError: true
      })
    }

    //delete dao
    await contracts.daoreg.delorg('org1', { authorization: `${daoreg}@active` })
  })

  it('Reset settings', async function() {
    await contracts.daoreg.resetsttngs({ authorization: `${daoreg}@active` })
  })

})

