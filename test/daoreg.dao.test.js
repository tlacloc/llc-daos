const assert = require('assert')
const { rpc } = require('../scripts/eos')
const { getContracts, createRandomAccount, Asset } = require('../scripts/eosio-util')
const { assertError } = require('../scripts/eosio-errors')

const { contractNames, contracts: configContracts, isLocalNode, sleep } = require('../scripts/config')

const { getParams, setParamsValue } = require('../scripts/contract-settings')

const { AssertionError } = require('assert')
const { updatePermissions } = require('../scripts/permissions')
const { SSL_OP_NETSCAPE_DEMO_CIPHER_CHANGE_BUG } = require('constants')

const { EnvironmentUtil } = require('./util/EnvironmentUtil')

const { TokenUtil } = require('./util/TokenUtil')
const { DaosFactory } = require('./util/DaoUtil')
const { OffersFactory, OfferConstants } = require('./util/OfferUtil')

const expect = require('chai').expect

const { daoreg, tlostoken } = contractNames



describe('Tests for dao registry', async function () {

  let contracts

  before(async function () {
    if (!isLocalNode()) {
      console.log('These tests should only be run on a local node')
      process.exit(1)
    }

  })

  beforeEach(async function () {
    await EnvironmentUtil.initNode()
    await sleep(4000)
    await EnvironmentUtil.deployContracts(configContracts)

    contracts = await getContracts([daoreg, tlostoken])

    await updatePermissions()

    await setParamsValue()

    await TokenUtil.create({ 
      issuer: tlostoken, 
      maxSupply: `1000000000000.0000 ${TokenUtil.tokenCode}`,
      contractAccount: tlostoken,
      contract: contracts.tlostoken
    })

  })

  afterEach(async function () {
    await EnvironmentUtil.killNode()

  })


  it('Create a new configuration parameter', async function () {

  	// Arrange
  	const settings =  ['testparam', ['uint64', 20], 'test param']

  	// Act
  	await contracts.daoreg.setparam(...settings, { authorization: `${daoreg}@active` })

  	// Assert
    settingsTable = await getParams()

    expect(settingsTable[3]).to.deep.equals({ // the contract begins with 3 prev params
      key: settings[0],
      value: settings[1],
      description: settings[2]
    })

  })

  it('Create a new DAO', async function () {

  	// Arrange
    const dao = await DaosFactory.createWithDefaults({dao: 'firstdao'})
    const actionParams = dao.getActionParams()

    // Act
    await contracts.daoreg.create(...actionParams, { authorization: `${dao.params.creator}@active` })

    // Assert
    const daoTable = await rpc.get_table_rows({
      code: daoreg,
			scope: daoreg,
	    table: 'daos',
      json: true,
			limit: 100
	})

	expect(daoTable.rows).to.deep.equals([{
		dao_id: 1,
    dao: dao.params.dao,
    creator: dao.params.creator,
    ipfs: dao.params.ipfs,
    attributes: dao.params.attributes,
    tokens: dao.params.tokens
    }])

  })

  it('Can not create a dao with same name', async function () {

  	// Arrange
  	let fail
  	let error

    const dao = await DaosFactory.createWithDefaults({})
    const getActionCreateParams = dao.getActionParams()

    // Act
    await contracts.daoreg.create(...getActionCreateParams, { authorization: `${dao.params.dao}@active` })
    try {
      await contracts.daoreg.create(...getActionCreateParams, { authorization: `${dao.params.dao}@active` })
      fail = false
		} catch (err) {
      fail = true
      error = err
    }

    // Assert
    expect(fail).to.be.true
    assertError({ error, textInside: `dao with the same name already exists`, verbose: false })

  })

  it('Dao can not be created if missing authorization of daoreg or creator', async function () {

  	// Arrange
  	let fail
  	let error
  	let tester1, tester2

    tester1 = await createRandomAccount()
    tester2 = await createRandomAccount()

    const dao = await DaosFactory.createWithDefaults({dao: "firstdao", creator: tester1})
    const getActionCreateParams = dao.getActionParams()

    // Act
    try {
      await contracts.daoreg.create(...getActionCreateParams, { authorization: `${tester2}@active` })
      fail = false
    } catch (err) {
	    fail = true
      error = err
    }

    // Assert
    expect(fail).to.be.true
    assertError({ error, textInside: `missing authority of ${tester1}`, verbose: false })

  })


})

