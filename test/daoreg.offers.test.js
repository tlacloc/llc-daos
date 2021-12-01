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



describe('Tests for offers in dao registry', async function () {

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

  it('Create a new offer', async function () {

  	// Arrange
    const dao = await DaosFactory.createWithDefaults({ })
    const actionParams = dao.getActionParams()

    await contracts.daoreg.create(...actionParams, { authorization: `${dao.params.dao}@active` })

    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.create({ 
      issuer: daoreg, 
      maxSupply: `1000000000000.0000 DTK`,
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.createFromDao({ 
      dao_id: 1, 
      token_contract: token_account,
      token_symbol: `4,DTK`,
      daoCreator: dao.params.creator,
      contract: contracts.daoreg
    })


    const offer = await OffersFactory.createWithDefaults({})
    const actionOfferCreateParams = offer.getActionParams()

    // Act
    await contracts.daoreg.createoffer(...actionOfferCreateParams, { authorization: `${dao.params.creator}@active` })

    // Assert
    const offerTable = await rpc.get_table_rows({
      code: daoreg,
		  scope: daoreg,
	    table: 'offers',
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


})

