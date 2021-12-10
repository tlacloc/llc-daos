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

    await TokenUtil.initToken({
      token_contract: contracts.tlostoken, 
      token_account: tlostoken, 
      issuer: daoreg, 
      max_supply: `1000000000000.0000 ${TokenUtil.tokenCode}`, 
      issue_amount: `1000000.0000 ${TokenUtil.tokenCode}` 
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

    await TokenUtil.initToken({
      token_contract: token_contract, 
      token_account: token_account, 
      issuer: daoreg, 
      max_supply: `1000000000000.0000 DTK`, 
      issue_amount: `1000000.0000 DTK` 
    })

    await TokenUtil.transfer({
      amount: "1000.0000 DTK",
      sender: daoreg,
      reciever: dao.params.creator,
      dao_id: "",
      contract: token_contract 
    })

    await TokenUtil.createFromDao({ 
      dao_id: 1, 
      token_contract: token_account,
      token_symbol: `4,DTK`,
      daoCreator: dao.params.creator,
      contract: contracts.daoreg,
      issuer: dao.params.creator,
      reciever: daoreg
    })

    
    const offer = await OffersFactory.createWithDefaults({ type: OfferConstants.sell })
    const actionOfferCreateParams = offer.getActionParams()

    // Act
    await contracts.daoreg.createoffer(...actionOfferCreateParams, { authorization: `${offer.params.creator}@active` })

    // Assert
    const offerTable = await rpc.get_table_rows({
      code: daoreg,
		  scope: 1,
	    table: 'offers',
      json: true,
		  limit: 100
  	})

  	expect(offerTable.rows).to.deep.equals([{
  		offer_id: 0,
      creator: offer.params.creator,
      available_quantity: offer.params.quantity,
      total_quantity: offer.params.quantity,
      price_per_unit: offer.params.price_per_unit,
      convertion_info: [],
      status: 1,
      timestamp: offerTable.rows[0].timestamp,
      type: offer.params.type,
      token_idx: 1,
      match_id: offerTable.rows[0].match_id
      
    }])

  })


  it('Offer match - new offer automaticaly accepts ', async function () {

    // Arrange
    const dao = await DaosFactory.createWithDefaults({ })
    const actionParams = dao.getActionParams()

    await contracts.daoreg.create(...actionParams, { authorization: `${dao.params.dao}@active` })

    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.initToken({
      token_contract: token_contract, 
      token_account: token_account, 
      issuer: daoreg, 
      max_supply: `1000000000000.0000 DTK`, 
      issue_amount: `1000000.0000 DTK` 
    })

    await TokenUtil.transfer({
      amount: "1000.0000 DTK",
      sender: daoreg,
      reciever: dao.params.creator,
      dao_id: "",
      contract: token_contract 
    })

    await TokenUtil.createFromDao({ 
      dao_id: 1, 
      token_contract: token_account,
      token_symbol: `4,DTK`,
      daoCreator: dao.params.creator,
      contract: contracts.daoreg,
      issuer: dao.params.creator,
      reciever: daoreg
    })

    
    const offer_buy = await OffersFactory.createWithDefaults({ type: OfferConstants.buy })
    const actionOfferBuyCreateParams = offer_buy.getActionParams()

    await TokenUtil.transfer({
      amount: "1000.0000 DTK",
      sender: daoreg,
      reciever: offer_buy.params.creator,
      dao_id: "",
      contract: token_contract 
    })

    await contracts.daoreg.createoffer(...actionOfferBuyCreateParams, { authorization: `${offer_buy.params.creator}@active` })

    await sleep(1000)

    const offer_sell = await OffersFactory.createWithDefaults({ type: OfferConstants.sell })
    const actionOfferSellCreateParams = offer_sell.getActionParams()

    await TokenUtil.transfer({
      amount: "1000.0000 DTK",
      sender: daoreg,
      reciever: offer_sell.params.creator,
      dao_id: "",
      contract: token_contract 
    })

    await TokenUtil.transfer({
      amount: "1000.0000 TLOS",
      sender: daoreg,
      reciever: offer_sell.params.creator,
      dao_id: "",
      contract: contracts.tlostoken 
    })

    console.log(actionOfferBuyCreateParams)

    console.log(actionOfferSellCreateParams)
    // Act
    
    await contracts.daoreg.createoffer(...actionOfferSellCreateParams, { authorization: `${offer_sell.params.creator}@active` })

    // Assert
    const offerTable = await rpc.get_table_rows({
      code: daoreg,
      scope: 1,
      table: 'offers',
      json: true,
      limit: 100
    })

    console.log(offerTable)

    expect(offerTable.rows.length).to.deep.equals(1)

  })
  

  it('Create more offers', async function () {

    // Arrange
    const dao = await DaosFactory.createWithDefaults({ })
    const actionParams = dao.getActionParams()

    await contracts.daoreg.create(...actionParams, { authorization: `${dao.params.dao}@active` })

    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.initToken({
      token_contract: token_contract, 
      token_account: token_account, 
      issuer: daoreg, 
      max_supply: `1000000000000.0000 DTK`, 
      issue_amount: `1000000.0000 DTK` 
    })

    await TokenUtil.transfer({
      amount: "1000.0000 DTK",
      sender: daoreg,
      reciever: dao.params.creator,
      dao_id: "",
      contract: token_contract 
    })

    await TokenUtil.createFromDao({ 
      dao_id: 1, 
      token_contract: token_account,
      token_symbol: `4,DTK`,
      daoCreator: dao.params.creator,
      contract: contracts.daoreg,
      issuer: dao.params.creator,
      reciever: daoreg
    })

    
    const offer_buy = await OffersFactory.createWithDefaults({ type: OfferConstants.buy })
    const actionOfferBuyCreateParams = offer_buy.getActionParams()

    console.log("offer: buy", actionOfferBuyCreateParams )
    await contracts.daoreg.createoffer(...actionOfferBuyCreateParams, { authorization: `${offer_buy.params.creator}@active` })

    await sleep(1000)

    const offer_sell = await OffersFactory.createWithDefaults({ type: OfferConstants.sell })
    const actionOfferSellCreateParams = offer_sell.getActionParams()

    console.log("offer: sell", actionOfferSellCreateParams)
    await contracts.daoreg.createoffer(...actionOfferSellCreateParams, { authorization: `${offer_sell.params.creator}@active` })

    await sleep(1000)

    const offer_sell2 = await OffersFactory.createWithDefaults({ type: OfferConstants.sell })
    const actionOfferSellCreateParams2 = offer_sell2.getActionParams()

    console.log("offer: sell", actionOfferSellCreateParams)
    await contracts.daoreg.createoffer(...actionOfferSellCreateParams2, { authorization: `${offer_sell2.params.creator}@active` })

    await sleep(1000)

    const offer_buy2 = await OffersFactory.createWithDefaults({ type: OfferConstants.buy })
    const actionOfferBuyCreateParams2 = offer_buy2.getActionParams()

    console.log("offer: buy", actionOfferBuyCreateParams2)
    await contracts.daoreg.createoffer(...actionOfferBuyCreateParams2, { authorization: `${offer_buy2.params.creator}@active` })
    
    // Act
    
    

    // Assert
    const tokenTable = await rpc.get_table_rows({
      code: daoreg,
      scope: 1,
      table: 'tokens',
      json: true,
      limit: 100
    })

    console.log(tokenTable)

    const offerTable = await rpc.get_table_rows({
      code: daoreg,
      scope: 1,
      table: 'offers',
      json: true,
      limit: 100
    })

    console.log(offerTable.rows)



  })



})

