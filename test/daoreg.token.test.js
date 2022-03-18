const assert = require('assert')
const { rpc } = require('../scripts/eos')
const { getContracts, createRandomAccount, randomAccountName, initContract, Asset, getAccountBalance } = require('../scripts/eosio-util')
const { assertError } = require('../scripts/eosio-errors')

const { contractNames, contracts: configContracts, isLocalNode, sleep } = require('../scripts/config')

const { getParams, setParamsValue } = require('../scripts/contract-settings')

const { AssertionError, fail } = require('assert')
const { updatePermissions } = require('../scripts/permissions')
const { SSL_OP_NETSCAPE_DEMO_CIPHER_CHANGE_BUG } = require('constants')

const { EnvironmentUtil } = require('./util/EnvironmentUtil')

const { TokenUtil } = require('./util/TokenUtil')
const { DaosFactory } = require('./util/DaoUtil')
const { OffersFactory, OfferConstants } = require('./util/OfferUtil')
const { func } = require('promisify')

const expect = require('chai').expect

const { daoreg, daoinf, tlostoken } = contractNames

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
    await TokenUtil.createWithErrors({
      issuer: daoreg,
      maxSupply: `1000000000000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    //assert 
    let ret = await rpc.get_currency_stats(token_account, TokenUtil.tokenTest)

    expect(ret[`${TokenUtil.tokenTest}`]).to.deep.equals({
      supply: `0.0000 ${TokenUtil.tokenTest}`,
      max_supply: `1000000000000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg
    })

  })

  it('Token symbol can not be longer than 7 characters  ', async function () {
    // Arrange
    let fail
    let error
    const [token_contract, token_account] = await TokenUtil.createTokenContract();
    let newSymbol = 'DTKKKOPTRD'

    // Act
    try {
      await TokenUtil.createWithErrors({
        issuer: daoreg,
        maxSupply: `1000000000000.0000 ${newSymbol}`,
        contractAccount: token_account,
        contract: token_contract
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }

    //Assert
    expect(fail).to.be.true
  })

  it('Token maximum supply can not be greater than 1e15', async function () {
    // Arrange
    let fail
    let error
    const [token_contract, token_account] = await TokenUtil.createTokenContract();
    // Act

    try {
      await TokenUtil.createWithErrors({
        issuer: daoreg,
        maxSupply: `1000000000000000.0000 ${TokenUtil.tokenTest}`,
        contractAccount: token_account,
        contract: token_contract
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }

    //Assert
    expect(fail).to.be.true
  })

  it('Token max-supply must be positive', async function () {
    // Arrange
    let fail
    let error
    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    // Act
    try {
      await TokenUtil.createWithErrors({
        issuer: daoreg,
        maxSupply: `-10000000000000.0000 ${TokenUtil.tokenTest}`,
        contractAccount: token_account,
        contract: token_contract
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }
    //Assert
    expect(fail).to.be.true
  })

  it('Token symbol already exists', async function () {
    // Arrange
    let fail
    let error
    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    // Act
    try {
      await TokenUtil.createWithErrors({
        issuer: daoreg,
        maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
        contractAccount: token_account,
        contract: token_contract
      })
      await TokenUtil.createWithErrors({
        issuer: daoreg,
        maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
        contractAccount: token_account,
        contract: token_contract
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }
    //Assert
    expect(fail).to.be.true

  })

  it('Create a new token and issue it', async function () {
    // Arrange
    const [token_contract, token_account] = await TokenUtil.createTokenContract();
    await TokenUtil.createWithErrors({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    // // Act
    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg,
      contract: token_contract,
      memo: 'issued token'
    })

    // Assert

    let ret = await rpc.get_currency_stats(token_account, TokenUtil.tokenTest)

    expect(ret[`${TokenUtil.tokenTest}`]).to.deep.equals({
      supply: `4000.0000 ${TokenUtil.tokenTest}`,
      max_supply: `10000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg
    })

  })

  it('Can not issue, token is invalid', async function () {
    // Arrange
    let fail
    let error
    const [token_contract, token_account] = await TokenUtil.createTokenContract();
    let newSymbol

    await TokenUtil.createWithErrors({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    // // Act
    try {
      await TokenUtil.issue({
        supply: `4000.0000 ${newSymbol}`,
        issuer: daoreg,
        contract: token_contract,
        memo: 'issued token'
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }

    // Assert
    expect(fail).to.be.true

  })

  it('Issue memo can not have more than 256 bytes', async function () {
    // Arrange
    let newMemo = `Lorem ipsum dolor sit amet, consectetur adipiscing elit, 
    sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
    Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris 
    nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor 
    in reprehenderit.`;
    let fail
    let error
    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.create({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    // // Act
    try {
      await TokenUtil.issue({
        supply: `4000.0000 ${TokenUtil.tokenTest}`,
        issuer: daoreg,
        contract: token_contract,
        memo: newMemo
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }

    // Assert
    expect(fail).to.be.true

  })


  it('Token need to be created before it can be used', async function () {
    //Arrange
    let fail
    let error
    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    //Act
    try {
      await TokenUtil.issue({
        supply: `4000.0000 ${TokenUtil.tokenTest}`,
        issuer: daoreg,
        contract: token_contract,
        memo: 'issued token'
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }

    //Assert
    expect(fail).to.be.true
  })

  it('Only issuer can issue tokens', async function () {
    //Arrange
    let fail
    let error
    const alice = await createRandomAccount()
    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.create({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg,
      contract: token_contract,
      memo: 'issued token'
    })

    //Act
    try {
      await TokenUtil.issue({
        supply: `4000.0000 ${TokenUtil.tokenTest}`,
        issuer: alice,
        contract: token_contract,
        memo: 'issued token'
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }

    //Assert
    expect(fail).to.be.true

  })

  it('Issued tokens must be a number, not a string', async function () {
    //Arrange
    let fail
    let error
    const [token_contract, token_account] = await TokenUtil.createTokenContract();
    let newSupply = 'one hundred'
    await TokenUtil.create({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    //Act
    try {
      await TokenUtil.issue({
        supply: `${newSupply} ${TokenUtil.tokenTest}`,
        issuer: daoreg,
        contract: token_contract,
        memo: 'issued token'
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }
    //Assert
    expect(fail).to.be.true

  })

  it('Issued tokens amount should be positive', async function () {
    //Arrange
    let fail
    let error
    const [token_contract, token_account] = await TokenUtil.createTokenContract();
    await TokenUtil.create({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    //Act
    try {
      await TokenUtil.issue({
        supply: `-4000.0000 ${TokenUtil.tokenTest}`,
        issuer: daoreg,
        contract: token_contract,
        memo: 'issued token'
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }

    //Assert
    expect(fail).to.be.true
  })

  it('Issued amount should contain 4 decimal places', async function () {
    //Arrange
    let fail
    let error
    const [token_contract, token_account] = await TokenUtil.createTokenContract();
    let newSupply = '4000.000'
    await TokenUtil.create({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    //Act
    try {
      await TokenUtil.issue({
        supply: `${newSupply} ${TokenUtil.tokenTest}`,
        issuer: daoreg,
        contract: token_contract,
        memo: 'issued token'
      })
    } catch (err) {
      fail = true
      error = err
    }

    //Assert
    expect(fail).to.be.true

  })

  it('Issued tokens exceeds available supply', async function () {
    //Arrange
    let fail
    let error
    const [token_contract, token_account] = await TokenUtil.createTokenContract();
    let newSupply = '40000.0000'
    await TokenUtil.create({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    //Act
    try {
      await TokenUtil.issue({
        supply: `${newSupply} ${TokenUtil.tokenTest}`,
        issuer: daoreg,
        contract: token_contract,
        memo: 'issued token'
      })
    } catch (err) {
      fail = true
      error = err
    }

    //Assert
    expect(fail).to.be.true

  })



  it(`Can not transfer to self`, async function () {
    // Arrange
    let fail
    let error
    const [token_contract, token_account] = await TokenUtil.createTokenContract();
    await TokenUtil.createWithErrors({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg,
      contract: token_contract,
      memo: 'issued token'
    })

    //Act
    try {
      await TokenUtil.transfer({
        amount: `100.0000 ${TokenUtil.tokenTest}`,
        sender: daoreg,
        reciever: daoreg,
        dao_id: "",
        contract: token_contract
      })
      fail = false
    } catch (err) {
      fail = true
    }

    //Assert
    expect(fail).to.be.true

  })

  it(`Transfer 100 of the new token to alice`, async function () {
    // Arrange
    const alice = await createRandomAccount()
    const [token_contract, token_account] = await TokenUtil.createTokenContract();
    await TokenUtil.createWithErrors({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg,
      contract: token_contract,
      memo: 'issued token'
    })

    //Act
    await TokenUtil.transfer({
      amount: `100.0000 ${TokenUtil.tokenTest}`,
      sender: daoreg,
      reciever: alice,
      dao_id: "",
      contract: token_contract
    })

    //Assert
    await TokenUtil.confirmBalance({
      code: token_account,
      scope: alice,
      token: TokenUtil.tokenTest,
      balance_available: '100.0000'
    })

    await TokenUtil.confirmBalance({
      code: token_account,
      scope: daoreg,
      token: TokenUtil.tokenTest,
      balance_available: '3900.0000'
    })


  })


  it("The transferred account does not exist", async function () {
    //Arrange
    let fail
    let error
    const miranda = await randomAccountName()
    const [token_contract, token_account] = await TokenUtil.createTokenContract();
    await TokenUtil.createWithErrors({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg,
      contract: token_contract,
      memo: 'issued token'
    })

    //Act
    try {
      await TokenUtil.transfer({
        amount: `100.0000 ${TokenUtil.tokenTest}`,
        sender: daoreg,
        reciever: miranda,
        dao_id: "",
        contract: token_contract
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }

    //Assert
    expect(fail).to.be.true

  })

  it('Issued tokens amount should be a number, not a string', async function () {
    //Arrange
    let fail
    let error
    const alice = await createRandomAccount()
    const [token_contract, token_account] = await TokenUtil.createTokenContract();
    await TokenUtil.createWithErrors({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg,
      contract: token_contract,
      memo: 'issued token'
    })

    //Act
    try {
      await TokenUtil.transfer({
        amount: `one hundred ${TokenUtil.tokenTest}`,
        sender: daoreg,
        reciever: alice,
        dao_id: "",
        contract: token_contract
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }

    //Assert
    expect(fail).to.be.true

  })

  it('Transfer amount should be a positive quantity', async function () {
    //Arrange
    let fail
    let error
    const alice = await createRandomAccount()
    const [token_contract, token_account] = await TokenUtil.createTokenContract();
    await TokenUtil.createWithErrors({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg,
      contract: token_contract,
      memo: 'issued token'
    })

    //Act
    try {
      await TokenUtil.transfer({
        amount: `-100.0000 ${TokenUtil.tokenTest}`,
        sender: daoreg,
        reciever: alice,
        dao_id: "",
        contract: token_contract
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }

    //Assert
    expect(fail).to.be.true

  })

  it('Transfer amount precision mismatch', async function () {
    //Arrange
    let fail
    let error
    const newSupple = '100.00'
    const alice = await createRandomAccount()
    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.createWithErrors({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg,
      contract: token_contract,
      memo: 'issued token'
    })

    //Act
    try {
      await TokenUtil.transfer({
        amount: `${newSupple} ${TokenUtil.tokenTest}`,
        sender: daoreg,
        reciever: alice,
        dao_id: "",
        contract: token_contract
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }

    //Assert
    expect(fail).to.be.true

  })


  it('Transfer memo has more than 256 bytes', async function () {
    //Arrange
    let fail
    let error
    let newMemo = `Lorem ipsum dolor sit amet, consectetur adipiscing elit, 
    sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
    Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris 
    nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor 
    in reprehenderit.`;
    const alice = await createRandomAccount()
    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.createWithErrors({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg,
      contract: token_contract,
      memo: 'issued token'
    })

    //Act
    try {
      await TokenUtil.transfer({
        amount: `100.0000 ${TokenUtil.tokenTest}`,
        sender: daoreg,
        reciever: alice,
        dao_id: newMemo,
        contract: token_contract
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }

    //Assert
    expect(fail).to.be.true

  })


  it('Add a new token in a DAO', async function () {
    // Arrange
    const dao = await DaosFactory.createWithDefaults({ dao: 'firstdao' })
    const actionParams = dao.getActionParams()
    await contracts.daoreg.create(...actionParams, { authorization: `${dao.params.creator}@active` })
    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.create({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    // Act
    await TokenUtil.addTokenToDao({
      dao_id: 1,
      token_contract: token_account,
      token_symbol: `4,${TokenUtil.tokenTest}`,
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
      tokens: [{ "first": token_account, "second": `4,${TokenUtil.tokenTest}` }]
    }])
  })




  it('Use token registered in dao', async function () {

    // Arrange
    const dao = await DaosFactory.createWithDefaults({ dao: 'firstdao' })
    const actionParams = dao.getActionParams()
    await contracts.daoreg.create(...actionParams, { authorization: `${dao.params.creator}@active` })
    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.create({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg,
      contract: token_contract,
      memo: 'issued token'
    })


    await TokenUtil.transfer({
      amount: `100.0000 ${TokenUtil.tokenTest}`,
      sender: daoreg,
      reciever: dao.params.creator,
      dao_id: 1,
      contract: token_contract
    })

    await TokenUtil.addTokenToDao({
      dao_id: 1,
      token_contract: token_account,
      token_symbol: `4,${TokenUtil.tokenTest}`,
      daoCreator: dao.params.creator,
      contract: contracts.daoreg
    })

    //Act
    await TokenUtil.transfer({
      amount: `25.0000 ${TokenUtil.tokenTest}`,
      sender: dao.params.creator,
      reciever: daoreg,
      dao_id: 1,
      contract: token_contract
    })


    // Assert

    await TokenUtil.confirmBalance({
      code: token_account,
      scope: dao.params.creator,
      token: TokenUtil.tokenTest,
      balance_available: `75.0000`
    })
    await TokenUtil.confirmBalance({
      code: token_account,
      scope: daoreg,
      token: TokenUtil.tokenTest,
      balance_available: '3925.0000'
    })

  })

  it('Transfer memo can not be empty, especify dao_id', async function () {
    // Arrange
    let fail
    let error
    const dao = await DaosFactory.createWithDefaults({ dao: 'firstdao' })
    const actionParams = dao.getActionParams()
    await contracts.daoreg.create(...actionParams, { authorization: `${dao.params.creator}@active` })
    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.create({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg,
      contract: token_contract,
      memo: 'issued token'
    })


    await TokenUtil.transfer({
      amount: `100.0000 ${TokenUtil.tokenTest}`,
      sender: daoreg,
      reciever: dao.params.creator,
      dao_id: 1,
      contract: token_contract
    })

    await TokenUtil.addTokenToDao({
      dao_id: 1,
      token_contract: token_account,
      token_symbol: `4,${TokenUtil.tokenTest}`,
      daoCreator: dao.params.creator,
      contract: contracts.daoreg
    })

    //Act
    try {
      await TokenUtil.transfer({
        amount: `25.0000 ${TokenUtil.tokenTest}`,
        sender: dao.params.creator,
        reciever: daoreg,
        dao_id: ' ',
        contract: token_contract
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }


    // Assert
    expect(fail).to.be.true

  })

  it('This is not a supported system token', async function () {
    // Arrange
    let fail
    let error
    const dao = await DaosFactory.createWithDefaults({ dao: 'firstdao' })
    const actionParams = dao.getActionParams()
    await contracts.daoreg.create(...actionParams, { authorization: `${dao.params.creator}@active` })
    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.create({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg,
      contract: token_contract,
      memo: 'issued token'
    })


    await TokenUtil.transfer({
      amount: `100.0000 ${TokenUtil.tokenTest}`,
      sender: daoreg,
      reciever: dao.params.creator,
      dao_id: 1,
      contract: token_contract
    })

    await TokenUtil.addTokenToDao({
      dao_id: 1,
      token_contract: token_account,
      token_symbol: `4,${TokenUtil.tokenTest}`,
      daoCreator: dao.params.creator,
      contract: contracts.daoreg
    })

    //Act
    try {
      await TokenUtil.transfer({
        amount: `25.0000 ${TokenUtil.tokenTest}`,
        sender: dao.params.creator,
        reciever: daoreg,
        dao_id: 0,
        contract: token_contract
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }

    //Assert
    expect(fail).to.be.true
  })

  it('Token is not supported by a registred Dao', async function () {
    // Arrange
    let fail
    let error
    const dao = await DaosFactory.createWithDefaults({ dao: 'firstdao' })
    const actionParams = dao.getActionParams()
    await contracts.daoreg.create(...actionParams, { authorization: `${dao.params.creator}@active` })
    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.create({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg,
      contract: token_contract,
      memo: 'issued token'
    })


    await TokenUtil.transfer({
      amount: `100.0000 ${TokenUtil.tokenTest}`,
      sender: daoreg,
      reciever: dao.params.creator,
      dao_id: 1,
      contract: token_contract
    })

    await TokenUtil.addTokenToDao({
      dao_id: 1,
      token_contract: token_account,
      token_symbol: `4,${TokenUtil.tokenTest}`,
      daoCreator: dao.params.creator,
      contract: contracts.daoreg
    })


    // //Act
    try {
      await TokenUtil.transfer({
        amount: `25.0000 ${TokenUtil.tokenTest2}`,
        sender: dao.params.creator,
        reciever: daoreg,
        dao_id: 1,
        contract: token_contract
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }

    //Assert
    expect(fail).to.be.true
  })

  it('Transfer Dao id has to be a positive number', async function () {
    // Arrange
    let fail
    let error
    const dao = await DaosFactory.createWithDefaults({ dao: 'firstdao' })
    const actionParams = dao.getActionParams()
    await contracts.daoreg.create(...actionParams, { authorization: `${dao.params.creator}@active` })
    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.create({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg,
      contract: token_contract,
      memo: 'issued token'
    })


    await TokenUtil.transfer({
      amount: `100.0000 ${TokenUtil.tokenTest}`,
      sender: daoreg,
      reciever: dao.params.creator,
      dao_id: 1,
      contract: token_contract
    })

    await TokenUtil.addTokenToDao({
      dao_id: 1,
      token_contract: token_account,
      token_symbol: `4,${TokenUtil.tokenTest}`,
      daoCreator: dao.params.creator,
      contract: contracts.daoreg
    })


    //Act
    try {
      await TokenUtil.transfer({
        amount: `25.0000 ${TokenUtil.tokenTest}`,
        sender: dao.params.creator,
        reciever: daoreg,
        dao_id: -1,
        contract: token_contract
      })

      fail = false
    } catch (err) {
      fail = true
      error = err
    }

    //Assert
    expect(fail).to.be.true
  })


  it('Can not transfer to Dao, organization not found', async function () {
    // Arrange
    let fail
    let error
    const dao = await DaosFactory.createWithDefaults({ dao: 'firstdao' })
    const actionParams = dao.getActionParams()
    await contracts.daoreg.create(...actionParams, { authorization: `${dao.params.creator}@active` })
    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.create({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg,
      contract: token_contract,
      memo: 'issued token'
    })

    await TokenUtil.transfer({
      amount: `100.0000 ${TokenUtil.tokenTest}`,
      sender: daoreg,
      reciever: dao.params.creator,
      dao_id: 1,
      contract: token_contract
    })

    await TokenUtil.addTokenToDao({
      dao_id: 1,
      token_contract: token_account,
      token_symbol: `4,${TokenUtil.tokenTest}`,
      daoCreator: dao.params.creator,
      contract: contracts.daoreg
    })


    //Act
    try {
      await TokenUtil.transfer({
        amount: `25.0000 ${TokenUtil.tokenTest}`,
        sender: dao.params.creator,
        reciever: daoreg,
        dao_id: 2,
        contract: token_contract
      })

      fail = false
    } catch (err) {
      fail = true
      error = err
    }

    //Assert
    expect(fail).to.be.true
  })

  it('Can not transfer, not enough balance', async function () {
    // Arrange
    let fail
    let error
    const dao = await DaosFactory.createWithDefaults({ dao: 'firstdao' })
    const actionParams = dao.getActionParams()
    await contracts.daoreg.create(...actionParams, { authorization: `${dao.params.creator}@active` })
    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.create({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg,
      contract: token_contract,
      memo: 'issued token'
    })

    await TokenUtil.transfer({
      amount: `100.0000 ${TokenUtil.tokenTest}`,
      sender: daoreg,
      reciever: dao.params.creator,
      dao_id: 1,
      contract: token_contract
    })

    await TokenUtil.addTokenToDao({
      dao_id: 1,
      token_contract: token_account,
      token_symbol: `4,${TokenUtil.tokenTest}`,
      daoCreator: dao.params.creator,
      contract: contracts.daoreg
    })


    //Act
    try {
      await TokenUtil.transfer({
        amount: `125.0000 ${TokenUtil.tokenTest}`,
        sender: dao.params.creator,
        reciever: daoreg,
        dao_id: 1,
        contract: token_contract
      })

      fail = false
    } catch (err) {
      fail = true
      error = err
    }

    //Assert
    expect(fail).to.be.true
  })

  it('Can not add token: Dao not found', async function () {
    //Arrange
    let fail
    let error
    const dao = await DaosFactory.createWithDefaults({ dao: 'firstdao' })
    const actionParams = dao.getActionParams()
    await contracts.daoreg.create(...actionParams, { authorization: `${dao.params.creator}@active` })
    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.create({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    //Act
    try {
      await TokenUtil.addTokenToDao({
        dao_id: 2,
        token_contract: token_account,
        token_symbol: `4,${TokenUtil.tokenTest}`,
        daoCreator: dao.params.creator,
        contract: contracts.daoreg
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }

    //Assert
    expect(fail).to.be.true
  })

  it('Can not add token: This token symbol is already added', async function () {
    //Arrange
    let fail
    let error
    const dao = await DaosFactory.createWithDefaults({ dao: 'firstdao' })
    const actionParams = dao.getActionParams()
    await contracts.daoreg.create(...actionParams, { authorization: `${dao.params.creator}@active` })
    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.create({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.addTokenToDao({
      dao_id: 1,
      token_contract: token_account,
      token_symbol: `4,${TokenUtil.tokenTest}`,
      daoCreator: dao.params.creator,
      contract: contracts.daoreg
    })


    // Act
    try {
      await TokenUtil.addTokenToDao({
        dao_id: 1,
        token_contract: token_account,
        token_symbol: `4,${TokenUtil.tokenTest}`,
        daoCreator: dao.params.creator,
        contract: contracts.daoreg
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }

    //Assert
    expect(fail).to.be.true
  })


  it('Token can be added only by creator', async function () {
    //Arrange
    let fail
    let error
    let secondUser = randomAccountName()
    const dao = await DaosFactory.createWithDefaults({ dao: 'firstdao' })
    const actionParams = dao.getActionParams()
    await contracts.daoreg.create(...actionParams, { authorization: `${dao.params.creator}@active` })

    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.create({
      issuer: daoreg,
      maxSupply: `1000000000000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    // Act
    try {
      await TokenUtil.addTokenToDao({
        dao_id: 1,
        token_contract: token_account,
        token_symbol: `4,${TokenUtil.tokenTest}`,
        daoCreator: secondUser,
        contract: contracts.daoreg
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }

    //Assert
    expect(fail).to.be.true

  })

  it('Account can receive different tokens from different contracts', async function () {
    //Arrange
    let tester1 = await createRandomAccount()
    let tester2 = await createRandomAccount()
    const [token_contract, token_account] = await TokenUtil.createTokenContract();
    const [token_contract_2, token_account_2] = await TokenUtil.createTokenContract();

    await TokenUtil.create({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })
    await TokenUtil.create({
      issuer: daoinf,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest2}`,
      contractAccount: token_account_2,
      contract: token_contract_2
    })

    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg,
      contract: token_contract,
      memo: 'issued token'
    })
    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest2}`,
      issuer: daoinf,
      contract: token_contract_2,
      memo: 'issued token'
    })

    //Act
    await TokenUtil.transfer({
      amount: `2000.0000 ${TokenUtil.tokenTest}`,
      sender: daoreg,
      reciever: tester1,
      dao_id: "",
      contract: token_contract
    })
    await TokenUtil.transfer({
      amount: `1000.0000 ${TokenUtil.tokenTest}`,
      sender: daoreg,
      reciever: tester2,
      dao_id: "",
      contract: token_contract
    })


    await TokenUtil.transfer({
      amount: `2000.0000 ${TokenUtil.tokenTest2}`,
      sender: daoinf,
      reciever: tester1,
      dao_id: "",
      contract: token_contract_2
    })
    await TokenUtil.transfer({
      amount: `1000.0000 ${TokenUtil.tokenTest2}`,
      sender: daoinf,
      reciever: tester2,
      dao_id: "",
      contract: token_contract_2
    })



    //Assert
    await TokenUtil.confirmBalance({
      code: token_account,
      scope: tester1,
      token: TokenUtil.tokenTest,
      balance_available: '2000.0000'
    })
    await TokenUtil.confirmBalance({
      code: token_account_2,
      scope: tester1,
      token: TokenUtil.tokenTest2,
      balance_available: '2000.0000'
    })

    await TokenUtil.confirmBalance({
      code: token_account,
      scope: tester2,
      token: TokenUtil.tokenTest,
      balance_available: '1000.0000'
    })
    await TokenUtil.confirmBalance({
      code: token_account_2,
      scope: tester2,
      token: TokenUtil.tokenTest2,
      balance_available: '1000.0000'
    })

    await TokenUtil.confirmBalance({
      code: token_account,
      scope: daoreg,
      token: TokenUtil.tokenTest,
      balance_available: '1000.0000'
    })
    await TokenUtil.confirmBalance({
      code: token_account_2,
      scope: daoinf,
      token: TokenUtil.tokenTest2,
      balance_available: '1000.0000'
    })


  })


  it('Account can receive different tokens from the same contract ', async function () {
    //Arrange
    let tester1 = await createRandomAccount()
    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.createWithErrors({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })
    await TokenUtil.createWithErrors({
      issuer: daoinf,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest2}`,
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg,
      contract: token_contract,
      memo: 'issued token'
    })
    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest2}`,
      issuer: daoinf,
      contract: token_contract,
      memo: 'issued token'
    })

    //Act
    await TokenUtil.transfer({
      amount: `2000.0000 ${TokenUtil.tokenTest}`,
      sender: daoreg,
      reciever: tester1,
      dao_id: "",
      contract: token_contract
    })
    await TokenUtil.transfer({
      amount: `1000.0000 ${TokenUtil.tokenTest2}`,
      sender: daoinf,
      reciever: tester1,
      dao_id: "",
      contract: token_contract
    })


    // //Assert
    await TokenUtil.confirmBalance({
      code: token_account,
      scope: tester1,
      token: TokenUtil.tokenTest,
      balance_available: '2000.0000'
    })
    await TokenUtil.confirmBalance({
      code: token_account,
      scope: tester1,
      token: TokenUtil.tokenTest2,
      balance_available: '1000.0000'
    })

    await TokenUtil.confirmBalance({
      code: token_account,
      scope: daoreg,
      token: TokenUtil.tokenTest,
      balance_available: '2000.0000'
    })

    await TokenUtil.confirmBalance({
      code: token_account,
      scope: daoinf,
      token: TokenUtil.tokenTest2,
      balance_available: '3000.0000'
    })


  })

  it('Allows to withdraw correctly', async function () {
    //Arrange
    const dao = await DaosFactory.createWithDefaults({ dao: 'firstdao' })
    const actionParams = dao.getActionParams()
    await contracts.daoreg.create(...actionParams, { authorization: `${dao.params.creator}@active` })

    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.createWithErrors({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg,
      contract: token_contract,
      memo: 'issued token'
    })

    await TokenUtil.transfer({
      amount: `100.0000 ${TokenUtil.tokenTest}`,
      sender: daoreg,
      reciever: dao.params.creator,
      dao_id: 1,
      contract: token_contract
    })

    await TokenUtil.addTokenToDao({
      dao_id: 1,
      token_contract: token_account,
      token_symbol: `4,${TokenUtil.tokenTest}`,
      daoCreator: dao.params.creator,
      contract: contracts.daoreg
    })

    await TokenUtil.transfer({
      amount: `75.0000 ${TokenUtil.tokenTest}`,
      sender: dao.params.creator,
      reciever: daoreg,
      dao_id: 1,
      contract: token_contract
    })

    await TokenUtil.checkBalance({
      code: daoreg,
      scope: dao.params.creator,
      table: 'balances',
      balance_available: `75.0000 ${TokenUtil.tokenTest}`,
      balance_locked: `0.0000 ${TokenUtil.tokenTest}`,
      id: 0,
      dao_id: 1,
      token_account: token_account
    })
    //Act
    await TokenUtil.withdraw({
      account: dao.params.creator,
      token_contract: token_account,
      amount: `10.0000 ${TokenUtil.tokenTest}`,
      contract: contracts.daoreg
    })

    //Assert
    await TokenUtil.checkBalance({
      code: daoreg,
      scope: dao.params.creator,
      table: 'balances',
      balance_available: `65.0000 ${TokenUtil.tokenTest}`,
      balance_locked: `0.0000 ${TokenUtil.tokenTest}`,
      id: 0,
      dao_id: 1,
      token_account: token_account
    })

  })

  it('Can not withdraw, not enough balance', async function () {
    //Arrange
    let fail
    let error
    const dao = await DaosFactory.createWithDefaults({ dao: 'firstdao' })
    const actionParams = dao.getActionParams()
    await contracts.daoreg.create(...actionParams, { authorization: `${dao.params.creator}@active` })

    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.createWithErrors({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg,
      contract: token_contract,
      memo: 'issued token'
    })

    await TokenUtil.transfer({
      amount: `100.0000 ${TokenUtil.tokenTest}`,
      sender: daoreg,
      reciever: dao.params.creator,
      dao_id: 1,
      contract: token_contract
    })

    await TokenUtil.addTokenToDao({
      dao_id: 1,
      token_contract: token_account,
      token_symbol: `4,${TokenUtil.tokenTest}`,
      daoCreator: dao.params.creator,
      contract: contracts.daoreg
    })

    await TokenUtil.transfer({
      amount: `75.0000 ${TokenUtil.tokenTest}`,
      sender: dao.params.creator,
      reciever: daoreg,
      dao_id: 1,
      contract: token_contract
    })

    await TokenUtil.checkBalance({
      code: daoreg,
      scope: dao.params.creator,
      table: 'balances',
      balance_available: `75.0000 ${TokenUtil.tokenTest}`,
      balance_locked: `0.0000 ${TokenUtil.tokenTest}`,
      id: 0,
      dao_id: 1,
      token_account: token_account
    })
    //Act
    try {
      await TokenUtil.withdraw({
        account: dao.params.creator,
        token_contract: token_account,
        amount: `100.0000 ${TokenUtil.tokenTest}`,
        contract: contracts.daoreg
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }

    //Assert
    expect(fail).to.be.true




  })

  it('Token account or symbol are not registered in the account', async function () {
    //Arrange
    let fail
    let error
    const alice = await createRandomAccount()
    const dao = await DaosFactory.createWithDefaults({ dao: 'firstdao' })
    const actionParams = dao.getActionParams()
    await contracts.daoreg.create(...actionParams, { authorization: `${dao.params.creator}@active` })

    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.createWithErrors({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg,
      contract: token_contract,
      memo: 'issued token'
    })

    await TokenUtil.transfer({
      amount: `100.0000 ${TokenUtil.tokenTest}`,
      sender: daoreg,
      reciever: dao.params.creator,
      dao_id: 1,
      contract: token_contract
    })

    await TokenUtil.addTokenToDao({
      dao_id: 1,
      token_contract: token_account,
      token_symbol: `4,${TokenUtil.tokenTest}`,
      daoCreator: dao.params.creator,
      contract: contracts.daoreg
    })

    await TokenUtil.transfer({
      amount: `75.0000 ${TokenUtil.tokenTest}`,
      sender: dao.params.creator,
      reciever: daoreg,
      dao_id: 1,
      contract: token_contract
    })

    await TokenUtil.checkBalance({
      code: daoreg,
      scope: dao.params.creator,
      table: 'balances',
      balance_available: `75.0000 ${TokenUtil.tokenTest}`,
      balance_locked: `0.0000 ${TokenUtil.tokenTest}`,
      id: 0,
      dao_id: 1,
      token_account: token_account
    })
    //Act
    try {
      await TokenUtil.withdraw({
        account: alice,
        token_contract: token_account,
        amount: `10.0000 ${TokenUtil.tokenTest}`,
        contract: contracts.daoreg
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }

    //Assert
    expect(fail).to.be.true
  })

  it('Amount to withdraw has to be higher than zero', async function () {
    //Arrange
    let fail
    let error
    const dao = await DaosFactory.createWithDefaults({ dao: 'firstdao' })
    const actionParams = dao.getActionParams()
    await contracts.daoreg.create(...actionParams, { authorization: `${dao.params.creator}@active` })

    const [token_contract, token_account] = await TokenUtil.createTokenContract();

    await TokenUtil.createWithErrors({
      issuer: daoreg,
      maxSupply: `10000.0000 ${TokenUtil.tokenTest}`,
      contractAccount: token_account,
      contract: token_contract
    })

    await TokenUtil.issue({
      supply: `4000.0000 ${TokenUtil.tokenTest}`,
      issuer: daoreg,
      contract: token_contract,
      memo: 'issued token'
    })

    await TokenUtil.transfer({
      amount: `100.0000 ${TokenUtil.tokenTest}`,
      sender: daoreg,
      reciever: dao.params.creator,
      dao_id: 1,
      contract: token_contract
    })

    await TokenUtil.addTokenToDao({
      dao_id: 1,
      token_contract: token_account,
      token_symbol: `4,${TokenUtil.tokenTest}`,
      daoCreator: dao.params.creator,
      contract: contracts.daoreg
    })

    await TokenUtil.transfer({
      amount: `75.0000 ${TokenUtil.tokenTest}`,
      sender: dao.params.creator,
      reciever: daoreg,
      dao_id: 1,
      contract: token_contract
    })

    await TokenUtil.checkBalance({
      code: daoreg,
      scope: dao.params.creator,
      table: 'balances',
      balance_available: `75.0000 ${TokenUtil.tokenTest}`,
      balance_locked: `0.0000 ${TokenUtil.tokenTest}`,
      id: 0,
      dao_id: 1,
      token_account: token_account
    })
    //Act
    try {
      await TokenUtil.withdraw({
        account: dao.params.creator,
        token_contract: token_account,
        amount: `0.0000 ${TokenUtil.tokenTest}`,
        contract: contracts.daoreg
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }


    //Assert
    expect(fail).to.be.true
  })


  it('Reset settings: missing authority', async function () {
    //Arrange
    let fail
    let error
    const alice = await createRandomAccount()
    await TokenUtil.resetsttngs({
      account: daoreg,
      contract: contracts.daoreg
    })

    //Act
    try {
      await TokenUtil.resetsttngs({
        account: alice,
        contract: contracts.daoreg
      })
      fail = false
    } catch (err) {
      fail = true
      error = err
    }

    //Assert
    expect(fail).to.be.true



  })

})
