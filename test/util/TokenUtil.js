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

  static async transfer ({ amount, sender, reciever, contract }) {
    await contract.transfer(sender, reciever, amount, '', { authorization: `${sender}@active`})
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

}

module.exports = { TokenUtil }