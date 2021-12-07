const assert = require('assert')

const { rpc } = require('../../scripts/eos')

const { assertError } = require('../../scripts/eosio-errors')
const { createRandomAccount, randomAccountName, initContract} = require('../../scripts/eosio-util')
const { createAccount, deployContract } = require('../../scripts/deploy')

const { devKey } = require('../../scripts/config')

class TokenUtil {

  static tokenCode = 'TLOS'
  static tokenPrecision = 4

  static async create ({ issuer, maxSupply, contractAccount, contract }) {
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

  static async issue ({ amount, issuer, contract }) {
    await contract.issue(issuer, amount, 'issued token', { authorization: `${issuer}@active` })
  }

  static async transfer ({ amount, sender, reciever, dao_id, contract }) {
    await contract.transfer(sender, reciever, amount, dao_id, { authorization: `${sender}@active`})
  }

  static async createFromDao ({ dao_id, token_contract, token_symbol, daoCreator, contract }) {
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

  static async initToken({token_contract, token_account, issuer, max_supply, issue_amount, transfer_amount }) {
    await this.create ({
      issuer: issuer,
      maxSupply: max_supply,
      contractAccount: token_account,
      contract: token_contract
    })

    await this.issue ({
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
    return [ token_contract, account ]
  }

  static async checkBalance ({code, scope, table, balance_available, balance_locked, id, dao_id, token_account}) {
      const _table = await rpc.get_table_rows({
          code,
          scope,
          table: table,
          json: true,
          limit: 100
      })
      
      if(table == 'balances') {
          assert.deepStrictEqual(_table.rows, [
              {
                  id,
                  available: balance_available,
                  locked: balance_locked,
                  dao_id,
                  token_account
              }
          ])
      } else if (table == 'accounts') {
          assert.deepStrictEqual(_table.rows, [
              {
                  balance: balance_available
              }
          ])
      }
  }


}

module.exports = { TokenUtil }