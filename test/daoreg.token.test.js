const assert = require('assert')
const { rpc } = require('../scripts/eos')
const { getContracts, createRandomAccount, initContract, Asset, getAccountBalance } = require('../scripts/eosio-util')
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

describe('Tests for tokens in dao registry', async function () {

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

  it('Create a new token', async function () {

  	// Arrange
    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    // Act
    await TokenUtil.create({ 
      issuer: daoreg, 
      maxSupply: `1000000000000.0000 DTK`,
      contractAccount: token_account,
      contract: token_contract
    })

    // Assert

  })

  it('Issue the new token', async function () {

    // Arrange
    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.create({ 
      issuer: daoreg, 
      maxSupply: "10000.0000 DTK",
      contractAccount: token_account,
      contract: token_contract
    })

    // Act
    await TokenUtil.issue({
      amount: "4000.0000 DTK",
      issuer: daoreg,
      contract: token_contract,
    })

    // Assert
    await TokenUtil.checkBalance({
      code : token_account, 
      scope: daoreg, 
      table: 'accounts', 
      balance_available : "4000.0000 DTK", 
      balance_locked : "", 
      id : "", 
      dao_id : "", 
      token_account : ""
    })


  })

  it('Transfer 100 of the new token to alice', async function () {

    // Arrange
    const alice = await createRandomAccount()

    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.create({ 
      issuer: daoreg, 
      maxSupply: "10000.0000 DTK",
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.issue({
      amount: "4000.0000 DTK",
      issuer: daoreg,
      contract: token_contract
    })

    //Act
    await TokenUtil.transfer({
      amount: "100.0000 DTK",
      sender: daoreg,
      reciever: alice,
      dao_id: "",
      contract: token_contract 
    })

    // Assert
    await TokenUtil.checkBalance({ // alice balance
      code : token_account, 
      scope: alice, 
      table: 'accounts', 
      balance_available : "100.0000 DTK", 
      balance_locked : "", 
      id : "", 
      dao_id : "", 
      token_account : ""
    })

    await TokenUtil.checkBalance({ // issuer balance
      code : token_account, 
      scope: daoreg, 
      table: 'accounts', 
      balance_available : "3900.0000 DTK", 
      balance_locked : "", 
      id : "", 
      dao_id : "", 
      token_account : ""
    })

  })

  it('Add a new token in a DAO', async function () {

    // Arrange
    const dao = await DaosFactory.createWithDefaults({dao: 'firstdao'})
    const actionParams = dao.getActionParams()

    await contracts.daoreg.create(...actionParams, { authorization: `${dao.params.creator}@active` })

    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.create({ 
      issuer: daoreg, 
      maxSupply: `1000000000000.0000 DTK`,
      contractAccount: token_account,
      contract: token_contract
    })

    // Act
    await TokenUtil.createFromDao({ 
      dao_id: 1, 
      token_contract: token_account,
      token_symbol: `4,DTK`,
      daoCreator: dao.params.creator,
      contract: contracts.daoreg
    })

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
      tokens: [{"first": token_account, "second": "4,DTK"}]
    }])

  })

  it('Use token registred in dao', async function () {

    // Arrange
    const dao = await DaosFactory.createWithDefaults({dao: 'firstdao'})
    const actionParams = dao.getActionParams()

    await contracts.daoreg.create(...actionParams, { authorization: `${dao.params.creator}@active` })

    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.create({ 
      issuer: daoreg, 
      maxSupply: "10000.0000 DTK",
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.issue({
      amount: "4000.0000 DTK",
      issuer: daoreg,
      contract: token_contract
    })

    await TokenUtil.transfer({
      amount: "100.0000 DTK",
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
      contract: contracts.daoreg
    })

    // Act

    await TokenUtil.transfer({
      amount: "100.0000 DTK",
      sender: dao.params.creator,
      reciever: daoreg, 
      dao_id: "1",
      contract: token_contract 
    })

    // Assert
    await TokenUtil.checkBalance({
      code : token_account, 
      scope: dao.params.creator, 
      table: 'accounts', 
      balance_available : "0.0000 DTK", 
      balance_locked : "", 
      id : "", 
      dao_id : "", 
      token_account : ""
    })

    await TokenUtil.checkBalance({
      code : daoreg, 
      scope: dao.params.creator, 
      table: 'balances', 
      balance_available : "100.0000 DTK", 
      balance_locked : "0.0000 DTK", 
      id : 0, 
      dao_id : 1, 
      token_account : token_account
    })

  })


})

