const assert = require('assert')

const { rpc } = require('../../scripts/eos')

const { assertError } = require('../../scripts/eosio-errors')
const { createRandomAccount, randomAccountName, initContract } = require('../../scripts/eosio-util')
const { createAccount, deployContract } = require('../../scripts/deploy')

const { devKey } = require('../../scripts/config')
const { expect } = require('chai')

class TokenUtil {
  static tokenCode = 'TLOS'
  static tokenTest = 'DTK'
  static tokenTest2 = 'BTK'

  static tokenPrecision = 4

  static async create({ issuer, maxSupply, contractAccount, contract }) {
    try {
      await contract.create(issuer, maxSupply, { authorization: `${contractAccount}@active` })
    } catch (error) {
      assertError({
        error,
        textInside: 'token with symbol already exists',
        verbose: false
      })
    }
  }

  //create with errors
  static async createWithErrors({ issuer, maxSupply, contractAccount, contract }) {
    await contract.create(issuer, maxSupply, { authorization: `${contractAccount}@active` })
  }

  static async issue({ supply, issuer, memo, contract }) {
    await contract.issue(issuer, supply, memo, { authorization: `${issuer}@active` })
  }

  static async transfer({ amount, sender, reciever, memo, contract }) {
    await contract.transfer(sender, reciever, amount, memo, { authorization: `${sender}@active` })
  }

  static async daoTransfer({ amount, sender, reciever, dao_id, contract }) {
    await contract.transfer(sender, reciever, amount, dao_id, { authorization: `${sender}@active` })
  }

  static async addTokenToDao({ dao_id, token_contract, token_symbol, daoCreator, contract }) {
    await contract.addtoken(dao_id, token_contract, token_symbol, { authorization: `${daoCreator}@active` })
  }

  static async createFromDao({ dao_id, token_contract, token_symbol, daoCreator, contract }) {
    try {
      await contract.addtoken(dao_id, token_contract, token_symbol, { authorization: `${daoCreator}@active` })
    } catch (error) {
      assertError({
        error,
        textInside: 'This token symbol is already added',
        verbose: false
      })
    }
  }



  static async initToken({ token_contract, token_account, issuer, max_supply, issue_amount, transfer_amount }) {
    await this.create({
      issuer: issuer,
      maxSupply: max_supply,
      contractAccount: token_account,
      contract: token_contract
    })

    await this.issue({
      amount: issue_amount,
      issuer: issuer,
      contract: token_contract
    })

  }
  static async createTokenContract() {
    const account = await randomAccountName()
    await createAccount({
      account: account,
      publicKey: devKey,
      stakes: {},
      creator: 'eosio'
    })
    await deployContract({
      name: 'tlostoken',
      nameOnChain: account
    })
    const token_contract = await initContract(account)
    return [token_contract, account]
  }
  static async confirmBalance({ code, scope, token, balance_available }) {
    const balance = await rpc.get_currency_balance(code, scope, token)
    expect(balance).to.deep.equals(
      [`${balance_available} ${token}`]
    )
  }

  static async checkBalance({ code, scope, table, balance_available, balance_locked, id, dao_id, token_account }) {
    const _table = await rpc.get_table_rows({
      code, // Contract that we target
      scope, // Account that owns the data
      table: table,  // Table name
      json: true, // Get the response as json
      limit: 100 //number of rows
    })

    if (table == 'balances') { // daoreg
      assert.deepStrictEqual(_table.rows, [
        {
          id,
          available: balance_available,
          locked: balance_locked,
          dao_id,
          token_account
        }
      ])
    } else if (table == 'accounts') { // token contract
      assert.deepStrictEqual(_table.rows, [
        {
          balance: balance_available
        }
      ])
    }
  }

  static async withdraw({ account, token_contract, amount, contract }) {
    await contract.withdraw(account, token_contract, amount, { authorization: `${account}@active` })
  }

  static async resetsttngs({ account, contract }) {
    await contract.resetsttngs({ authorization: `${account}@active` })
  }


}

module.exports = { TokenUtil }