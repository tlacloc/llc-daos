const { publicKeys, owner } = require('./config')
const { createAccount } = require('./deploy')
const { accountExists } = require('./eosio-errors')
const { updatePermissions } = require('./permissions')

const stakes = {
  cpu: '40.0000 TLOS',
  net: '40.0000 TLOS',
  ram: 1000000
}

const daosAccounts = {
  firstuser: 'testuseraaa',
  seconduser: 'testuserbbb',
  thirduser: 'testuseryyy',
  fourthuser: 'testuserzzz',
  firstdao: "dao.org1",
  seconddao: "dao.org2"
}

async function createDevelopAccounts (account) {
  console.log('create develop account:', account)
  try {
    await createAccount({
      account: account,
      publicKey: publicKeys.active,
      stakes: stakes,
      creator: owner
    })
  } catch (err) {
    accountExists(err)
  }
}

async function developAccounts () {
  for (var account in daosAccounts) {
    await createDevelopAccounts(daosAccounts[account])
  }
}

module.exports = {
  daosAccounts, developAccounts
}
