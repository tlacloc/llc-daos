require('dotenv').config()

const contract = (name, nameOnChain) => {
  return {
    name,
    nameOnChain,
    type: 'contract',
    stakes: {
      cpu: '20.0000 TLOS',
      net: '20.0000 TLOS',
      ram: 1000000
    }
  }
}

const supportedChains = {
  local: 'local',
  telosTestnet: 'telosTestnet',
  telosMainnet: 'telosMainnet'
}

const ownerByChain = {
  [supportedChains.local]: 'eosio',
  [supportedChains.telosTestnet]: 'm1ownerp2pex',
  [supportedChains.telosMainnet]: ''
}

const ownerPublicKeysByChain = {
  [supportedChains.local]: {
    owner: 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV',
    active: 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV'
  },
  [supportedChains.telosTestnet]: {
    owner: 'EOS6PtkWLquhJYFxjU8mWTtg8eZWWjp39FQ2m3Xrceun9V8Z6fZNQ',
    active: 'EOS6PtkWLquhJYFxjU8mWTtg8eZWWjp39FQ2m3Xrceun9V8Z6fZNQ'
  },
  [supportedChains.telosMainnet]: {

  }
}

const publicKeysByChain = {
  [supportedChains.local]: {
    owner: 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV',
    active: 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV'
  },
  [supportedChains.telosTestnet]: {
    owner: 'EOS6PtkWLquhJYFxjU8mWTtg8eZWWjp39FQ2m3Xrceun9V8Z6fZNQ',
    active: 'EOS6PtkWLquhJYFxjU8mWTtg8eZWWjp39FQ2m3Xrceun9V8Z6fZNQ'
  },
  [supportedChains.telosMainnet]: {

  }
}

const contractsConfig = {
  [supportedChains.local]: [
    contract('nullcontract', 'm1nulldaos'),
    contract('daoreg', 'daoregistry'),
    contract('daoinf', 'daoinfo')
  ],
  [supportedChains.telosTestnet]: [
    contract('daoreg', 'daoregistry'),
    contract('daoinf', 'daoinfo')
  ],
  [supportedChains.telosMainnet]: [

  ]
}

const chain = process.env.CHAIN_NAME

const owner = ownerByChain[chain]
const ownerPublicKeys = ownerPublicKeysByChain[chain]
const publicKeys = publicKeysByChain[chain]

const contracts = contractsConfig[chain]
const contractNames = {}
const nameOnChainToName = {}

for (const c of contracts) {
  contractNames[c.name] = c.nameOnChain
  nameOnChainToName[c.nameOnChain] = c.name
}

const permissionsConfig = [
  {
    target: `${contractNames.daoreg}@active`,
    actor: `${contractNames.daoreg}@eosio.code`
  },
  {
    target: `${contractNames.daoinf}@active`,
    actor: `${contractNames.daoinf}@eosio.code`
  }
]

function isLocalNode () {
  return chain == supportedChains.local
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  contracts, contractNames, nameOnChainToName, owner, ownerPublicKeys, publicKeys, isLocalNode, sleep, chain, permissionsConfig
}
