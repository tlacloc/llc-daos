const { rpc } = require('../scripts/eos')
const { getContracts, initContract, createRandomAccount, Asset } = require('../scripts/eosio-util')
const { contractNames, contracts: configContracts, isLocalNode, sleep } = require('../scripts/config')
const { setParamsValue } = require('../scripts/contract-settings')
const { updatePermissions } = require('../scripts/permissions')
const { EnvironmentUtil } = require('./util/EnvironmentUtil')
const { TokenUtil } = require('./util/TokenUtil')
const { DaosFactory } = require('./util/DaoUtil')
const { OffersFactory, OfferConstants } = require('./util/OfferUtil')
const expect = require('chai').expect
const { daoreg, tlostoken } = contractNames

describe('Tests for offers in dao registry', async function () {

  let contracts

  // test accounts
  let bob, alice, dao_creator

  let eosio_token_contract
  const eosio_account = 'eosio.token'

  before(async function () {
    if (!isLocalNode()) {
      console.log('These tests should only be run on a local node')
      process.exit(1)
    }

  })

  beforeEach(async function () {
    //start nodeos
    await EnvironmentUtil.initNode()
    await sleep(4000) //await some blocks 
    //deploy contracts: daoreg,daoinf,tlostoken
    await EnvironmentUtil.deployContracts(configContracts)

    await EnvironmentUtil.deployContract({ name: 'tlostoken', nameOnChain: eosio_account })

    eosio_token_contract = await initContract(eosio_account)

    contracts = await getContracts([daoreg, tlostoken])

    await updatePermissions()

    await setParamsValue()

    // TLOS contract

    // eosio_token_contract = await initContract(eosio_account)

    // await EnvironmentUtil.deployContract(eosio_account)




    // create & issue token
    await TokenUtil.initToken({
      token_contract: eosio_token_contract,
      token_account: eosio_account,
      issuer: daoreg,
      max_supply: `1000000000000.0000 ${TokenUtil.tokenCode}`,
      issue_amount: `1000000.0000 ${TokenUtil.tokenCode}`,
      memo: 'Issued token'
    })

    // create testing accounts
    bob = await createRandomAccount()
    alice = await createRandomAccount()

    // give tlos to accounts
    await TokenUtil.transfer({
      amount: `1000.0000 ${TokenUtil.tokenCode}`,
      sender: daoreg,
      reciever: alice,
      dao_id: "",
      contract: eosio_token_contract
    })
    await TokenUtil.transfer({
      amount: `1000.0000 ${TokenUtil.tokenCode}`,
      sender: daoreg,
      reciever: bob,
      dao_id: "",
      contract: eosio_token_contract
    })

    // create dao
    dao_creator = await createRandomAccount()
    const dao = await DaosFactory.createWithDefaults({ creator: dao_creator, dao: 'firstdao' })
    const actionCreateDaoParams = dao.getActionParams()
    await contracts.daoreg.create(...actionCreateDaoParams, { authorization: `${dao_creator}@active` })

    // create & register token in dao
    let [token_contract, token_account] = await TokenUtil.createTokenContract()

    // token is created
    await TokenUtil.create({
      issuer: daoreg,
      maxSupply: "10000.0000 DTK",
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.issue({
      supply: "4000.0000 DTK",
      issuer: daoreg,
      memo: 'issued token',
      contract: token_contract
    })

    await TokenUtil.transfer({
      amount: "100.0000 DTK",
      sender: daoreg,
      reciever: dao_creator,
      dao_id: "",
      contract: token_contract
    })

    await TokenUtil.addTokenToDao({
      dao_id: 1,
      token_contract: token_account,
      token_symbol: `4,DTK`,
      daoCreator: dao_creator,
      contract: contracts.daoreg
    })

    //  deposit to daoreg
    await TokenUtil.transfer({
      amount: "100.0000 DTK",
      sender: dao_creator,
      reciever: daoreg,
      dao_id: "1",
      contract: token_contract
    })

    // check balances (user balance needs to be deposited on daoreg)
    await TokenUtil.checkBalance({
      code: token_account,
      scope: dao_creator,
      table: 'accounts',
      balance_available: "0.0000 DTK",
      balance_locked: "",
      id: "",
      dao_id: "",
      token_account: ""
    })

    await TokenUtil.checkBalance({
      code: daoreg,
      scope: dao_creator,
      table: 'balances',
      balance_available: "100.0000 DTK",
      balance_locked: "0.0000 DTK",
      id: 0,
      dao_id: 1,
      token_account: token_account
    })

    // ALICE BALANCE

    // give alice some tokens to play
    await TokenUtil.transfer({
      amount: "100.0000 DTK",
      sender: daoreg,
      reciever: alice,
      dao_id: "",
      contract: token_contract
    })

    //  deposit to daoreg
    await TokenUtil.transfer({
      amount: "100.0000 DTK",
      sender: alice,
      reciever: daoreg,
      dao_id: "1",
      contract: token_contract
    })

    // check balances (user balance needs to be deposited on daoreg)
    await TokenUtil.checkBalance({
      code: token_account,
      scope: alice,
      table: 'accounts',
      balance_available: "0.0000 DTK",
      balance_locked: "",
      id: "",
      dao_id: "",
      token_account: ""
    })

    await TokenUtil.checkBalance({
      code: daoreg,
      scope: alice,
      table: 'balances',
      balance_available: "100.0000 DTK",
      balance_locked: "0.0000 DTK",
      id: 0,
      dao_id: 1,
      token_account: token_account
    })

    // BOB BALANCE

    // give alice some tokens to play
    await TokenUtil.transfer({
      amount: "100.0000 DTK",
      sender: daoreg,
      reciever: bob,
      dao_id: "",
      contract: token_contract
    })

    //  deposit to daoreg
    await TokenUtil.transfer({
      amount: "100.0000 DTK",
      sender: bob,
      reciever: daoreg,
      dao_id: "1",
      contract: token_contract
    })

    // check balances (user balance needs to be deposited on daoreg)
    await TokenUtil.checkBalance({
      code: token_account,
      scope: bob,
      table: 'accounts',
      balance_available: "0.0000 DTK",
      balance_locked: "",
      id: "",
      dao_id: "",
      token_account: ""
    })

    await TokenUtil.checkBalance({
      code: daoreg,
      scope: bob,
      table: 'balances',
      balance_available: "100.0000 DTK",
      balance_locked: "0.0000 DTK",
      id: 0,
      dao_id: 1,
      token_account: token_account
    })


  })

  afterEach(async function () {
    await EnvironmentUtil.killNode()

  })

  it('Create a sell offer', async function () {
    // Arrange
    const offer = await OffersFactory.createWithDefaults({ creator: alice, type: OfferConstants.sell })
    const actionOfferCreateParams = offer.getActionParams()

    // Act
    await contracts.daoreg.createoffer(...actionOfferCreateParams, { authorization: `${offer.params.creator}@active` })

    // Assert

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
      creation_date: offerTable.rows[0].creation_date,
      type: offer.params.type,
      token_idx: 1,
      match_id: offerTable.rows[0].match_id

    }])

  })

  it('Create a buy offer', async function () {

    // Arrange
    const offer = await OffersFactory.createWithDefaults({ creator: alice, type: OfferConstants.buy })
    const actionOfferCreateParams = offer.getActionParams()

    await TokenUtil.transfer({ // deposit to dao
      amount: `1.0000 ${TokenUtil.tokenCode}`,
      sender: alice,
      reciever: daoreg,
      dao_id: "0",
      contract: eosio_token_contract
    })

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
      creation_date: offerTable.rows[0].creation_date,
      type: offer.params.type,
      token_idx: 1,
      match_id: offerTable.rows[0].match_id

    }])

  })


  it('Offer match - sell offer is accepted insted of create a new one', async function () {


    // Arrange

    const offer_sell = await OffersFactory.createWithDefaults({ creator: bob, type: OfferConstants.sell })
    const actionOfferSellCreateParams = offer_sell.getActionParams()

    await contracts.daoreg.createoffer(...actionOfferSellCreateParams, { authorization: `${offer_sell.params.creator}@active` })



    const offer_buy = await OffersFactory.createWithDefaults({ creator: alice, type: OfferConstants.buy })
    const actionOfferBuyCreateParams = offer_buy.getActionParams()

    await TokenUtil.transfer({ // deposit to dao
      amount: `0.1000 ${TokenUtil.tokenCode}`,
      sender: alice,
      reciever: daoreg,
      dao_id: "0",
      contract: eosio_token_contract
    })

    // Act
    await contracts.daoreg.createoffer(...actionOfferBuyCreateParams, { authorization: `${offer_buy.params.creator}@active` })

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
      creator: offer_sell.params.creator,
      available_quantity: "0.0000 DTK",
      total_quantity: offer_sell.params.quantity,
      price_per_unit: offer_sell.params.price_per_unit,
      convertion_info: [],
      status: 0,
      creation_date: offerTable.rows[0].creation_date,
      type: offer_sell.params.type,
      token_idx: 1,
      match_id: offerTable.rows[0].match_id

    }])

    // users balances
    const bobsBalance = await rpc.get_table_rows({
      code: daoreg,
      scope: bob,
      table: 'balances',
      json: true,
      limit: 100
    })



    expect(bobsBalance.rows).to.deep.equals([{
      id: 0,
      available: "99.0000 DTK",
      locked: "0.0000 DTK",
      dao_id: 1,
      token_account: bobsBalance.rows[0].token_account
    }, {
      id: 1,
      available: "0.1000 TLOS",
      locked: "0.0000 TLOS",
      dao_id: 1,
      token_account: bobsBalance.rows[1].token_account

    }])

    const alicesBalance = await rpc.get_table_rows({
      code: daoreg,
      scope: alice,
      table: 'balances',
      json: true,
      limit: 100
    })

    expect(alicesBalance.rows).to.deep.equals([{
      id: 0,
      available: "101.0000 DTK",
      locked: "0.0000 DTK",
      dao_id: 1,
      token_account: alicesBalance.rows[0].token_account
    }, {
      id: 1,
      available: "0.0000 TLOS",
      locked: "0.0000 TLOS",
      dao_id: 0,
      token_account: alicesBalance.rows[1].token_account

    }])


  })

  /*
    it('Create more offers', async function () {
  
      // Arrange
      const dao = await DaosFactory.createWithDefaults({})
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
  
      console.log("offer: buy", actionOfferBuyCreateParams)
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
  
  
  */
})

