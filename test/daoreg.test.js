const assert = require('assert')
const { rpc } = require('../scripts/eos')
const { getContracts, getAccountBalance, initContract, randomAccountName } = require('../scripts/eosio-util')
const { daosAccounts } = require('../scripts/daos-util')
const { assertError } = require('../scripts/eosio-errors')
const { contractNames, isLocalNode, sleep } = require('../scripts/config')
const { setParamsValue } = require('../scripts/contract-settings')
const { AssertionError } = require('assert/strict')
const { createAccount, deployContract } = require('../scripts/deploy')
const { SSL_OP_NETSCAPE_DEMO_CIPHER_CHANGE_BUG } = require('constants')
const { daoreg, daoinf, tlostoken } = contractNames


const { firstuser, seconduser, thirduser, fourthuser, firstdao, seconddao } = daosAccounts


const publicKey = 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV';

const creator = 'eosio';

async function createTokenContract() {
    const account = await randomAccountName()
    await createAccount({account, publicKey, creator})
    await deployContract({
        name: 'tlostoken',
        nameOnChain: account
    })
    const token_contract = await initContract(account)
    return [ token_contract, account ]
}

async function createTokenAndTransfer(token_contract, account, issuer, tester1, tester2, max_supply, quantity_issue, quantity_transfer) {
 
    await token_contract.create(issuer, max_supply, {authorization: `${account}@active`})
    await token_contract.issue(issuer, quantity_issue, '', { authorization: `${issuer}@active`})
    await token_contract.transfer(issuer, tester1, quantity_transfer, '', { authorization: `${issuer}@active`})
    await token_contract.transfer(issuer, tester2, quantity_transfer, '', { authorization: `${issuer}@active`})    
}

async function checkBalance(code, scope, table_to_check, balance_available, balance_locked, id, dao_id, token_account){
    let _table = await rpc.get_table_rows({
        code,
        scope,
        table: table_to_check,
        json: true,
        limit: 100
    })
    
    if(table_to_check == 'balances') {
        assert.deepStrictEqual(_table.rows, [
            {
                id,
                available: balance_available,
                locked: balance_locked,
                dao_id,
                token_account
            }
        ])
    } else if (table_to_check == 'accounts') {
        assert.deepStrictEqual(_table.rows, [
            {
                balance: balance_available
            }
        ])
    }
}

describe('Dao registry', async () => {
    let contracts;
    let daousers;
    let tester1, tester2
    let eosio_token_contract
    let eosio_account
    let users

    before(async () => {
        if (!isLocalNode()) {
            console.log('These test should only be run on local node')
            process.exit(1)
        }
        contracts = await getContracts([daoreg, tlostoken]) 
        daousers = [firstuser, seconduser, thirduser]
        await setParamsValue()

        tester1 = await randomAccountName();
        await createAccount({ account: tester1, publicKey, creator })

        tester2 = await randomAccountName();
        await createAccount({ account: tester2, publicKey, creator })

        users = [tester1, tester2]

        eosio_account = 'eosio.token'

        try {
            await createAccount({ account: eosio_account, publicKey, creator })
            await deployContract({
                name: 'tlostoken',
                nameOnChain: eosio_account
            })            
        } catch (error) {
            assertError({
                error,
                textInside: 'Cannot create account named eosio.token, as that name is already taken',
                message: 'Token symbol already registered (expected)',
                throwError: true
            })
        }
        eosio_token_contract = await initContract(eosio_account)

        try {
            await eosio_token_contract.create(eosio_account, "10000000000.0000 TLOS", { authorization: `${eosio_account}@active` })
            await eosio_token_contract.issue(eosio_account, "10000000000.0000 TLOS", '', { authorization: `${eosio_account}@active` })
        } catch (error) {
            assertError({
                error,
                textInside: 'token with symbol already exists',
                message: 'Token symbol already registered (expected)',
                throwError: true
            })
        }
        await eosio_token_contract.transfer(eosio_account, tester1, "100.0000 TLOS", '', { authorization: `${eosio_account}@active` })
        await eosio_token_contract.transfer(eosio_account, tester2, "100.0000 TLOS", '', { authorization: `${eosio_account}@active` })

    })

    beforeEach(async () => {
        await contracts.daoreg.reset(users, { authorization: `${daoreg}@active` })
    })

    it('Settings, set a new param', async () => {
        await contracts.daoreg.setparam('testparam', ['uint64', 20], 'test param', { authorization: `${daoreg}@active` })

        const settingParam = await rpc.get_table_rows({
            code: daoreg,
            scope: daoreg,
            table: 'config',
            json: true,
            limit: 100
        })
        console.log(JSON.stringify(settingParam, null, 2))

    })

    it('Create DAO', async function () {
        await contracts.daoreg.create(
            firstdao,
            firstuser,
            'HASH_1',
            { authorization: `${firstdao}@active` }
        )

        let daoCreation = true;
        try {
            await contracts.daoreg.create(
                seconddao,
                seconduser,
                'HASH_2',
                { authorization: `${seconduser}@active` })
            daoCreation = false
        } catch (error) {
            assertError({
                error,
                textInside: `missing authority of ${seconddao}`,
                message: 'authorization of dao needed (expected)',
                throwError: true
            })
        }

        const dao_table = await rpc.get_table_rows({
            code: daoreg,
            scope: daoreg,
            table: 'daos',
            json: true,
            limit: 100
        })

        assert.deepStrictEqual(dao_table.rows, [
            {
                dao_id: 1,
                dao: firstdao,
                creator: firstuser,
                ipfs: 'HASH_1',
                attributes: [],
                tokens: []
            }
        ])

        assert.deepStrictEqual(daoCreation, true)
    })

    it('Create another DAO with same name', async function () {
        await contracts.daoreg.create(
            firstdao,
            firstuser,
            'HASH_1',
            { authorization: `${firstdao}@active` }
        )

        let daoCreatedTwice = false;
        try {
            await contracts.daoreg.create(
                firstdao,
                seconduser,
                'HASH_2',
                { authorization: `${firstdao}@active` })
            daoCreatedTwice = true
        } catch (error) {
            assertError({
                error,
                textInside: `dao with the same name already exists`,
                message: 'can not create dao with same name (expected)',
                throwError: true
            })
        }

        assert.deepStrictEqual(daoCreatedTwice, false)
    })

    it('Update IPFS DAO', async function () {
        // create DAO
        await contracts.daoreg.create(
            firstdao,
            firstuser,
            'HASH_1',
            { authorization: `${firstdao}@active` }
        )

        // update DAO by the creator
        await contracts.daoreg.update(
            1,
            'NEW_HASH_1',
            { authorization: `${firstuser}@active` }
        )

        let updateIpfsOnlyOwner = true
        try {
            await contracts.daoreg.update(
                1,
                'NEW_HASH_2',
                { authorization: `${seconduser}@active` })
            updateIpfsOnlyOwner = false
        } catch (error) {
            assertError({
                error,
                textInside: `missing authority of ${firstuser}`,
                message: 'dao cannot be updated by someone else (expected)',
                throwError: true
            })
        }

        let updateIpfsIfFound = true
        try {
            await contracts.daoreg.update(
                2,
                'NEW_HASH3',
                { authorization: `${daoreg}@active` })
            updateIpfsIfFound = false
        } catch (error) {
            assertError({
                error,
                textInside: "Organization not found",
                message: "DAO does not exists, can not be updated (expected)",
                throwError: true
            })
        }

        const dao_table = await rpc.get_table_rows({
            code: daoreg,
            scope: daoreg,
            table: 'daos',
            json: true,
            limit: 100
        })

        assert.deepStrictEqual(dao_table.rows, [
            {
                dao_id: 1,
                dao: firstdao,
                creator: firstuser,
                ipfs: 'NEW_HASH_1',
                attributes: [],
                tokens: []
            }
        ])

        assert.deepStrictEqual(updateIpfsOnlyOwner, true)
        assert.deepStrictEqual(updateIpfsIfFound, true)
    })

    it('Delete DAO', async function () {
        // create DAO
        await contracts.daoreg.create(
            firstdao,
            firstuser,
            'HASH_1',
            { authorization: `${firstdao}@active` }
        )

        // DAO can only be deleted by daoreg
        let deleteDaoByCreator = true
        try {
            await contracts.daoreg.delorg(
                1,
                { authorization: `${firstuser}@active` })
            deleteDaoByCreator = false

        } catch (error) {
            assertError({
                error,
                textInside: `missing authority of ${daoreg}`,
                message: 'users can not delete dao (expected)',
                throwError: true
            })
        }

        let deleteDaoIfFound = true
        try {
            await contracts.daoreg.delorg(
                2,
                { authorization: `${daoreg}@active` })
            deleteDaoIfFound = false
        } catch (error) {
            assertError({
                error,
                textInside: "Organization not found",
                message: "DAO does not exists, can not be updated (expected)",
                throwError: true
            })
        }

        await contracts.daoreg.delorg(
            1,
            { authorization: `${daoreg}@active` }
        )

        const dao_table = await rpc.get_table_rows({
            code: daoreg,
            scope: daoreg,
            table: 'daos',
            json: true,
            limit: 100
        })

        assert.deepStrictEqual(dao_table.rows, [])
        assert.deepStrictEqual(deleteDaoByCreator, true)
        assert.deepStrictEqual(deleteDaoIfFound, true)
    })

    it('Upsert attributes', async function () {
        await contracts.daoreg.create(
            firstdao,
            firstuser,
            'HASH_1',
            { authorization: `${firstdao}@active` }
        )

        let upsertattrsByCreator = true
        try {
            await contracts.daoreg.upsertattrs(
                1,
                [
                    { first: "first attribute", second: ['uint64', 001] },
                    { first: "second attribute", second: ['string', 'DAOO'] },
                ],
                { authorization: `${seconduser}@active` })
            upsertattrsByCreator = false
        } catch (error) {
            assertError({
                error,
                textInside: `missing authority of ${firstuser}`,
                message: 'add or modify attributes can only be done by creator',
                throwError: true
            })
        }

        let upsertattrsDaoIfFound = true
        try {
            await contracts.daoreg.upsertattrs(
                2,
                [
                    { first: "first attribute", second: ['uint64', 007] },
                    { first: "second attribute", second: ['string', 'this should fail'] },
                ],
                { authorization: `${firstuser}@active` })
            upsertattrsDaoIfFound = false
        } catch (error) {
            assertError({
                error,
                textInside: "Organization not found",
                message: "DAO does not exists, can not be updated (expected)",
                throwError: true
            })
        }

        await contracts.daoreg.upsertattrs(
            1,
            [
                { first: "first attribute", second: ['uint64', 001] },
                { first: "second attribute", second: ['string', 'DAOO'] }
            ],
            { authorization: `${firstuser}@active` }
        )

        await contracts.daoreg.upsertattrs(
            1,
            [
                { first: "first attribute", second: ['string', 'updated attribute'] }
            ],
            { authorization: `${firstuser}@active` }
        )

        const dao_table = await rpc.get_table_rows({
            code: daoreg,
            scope: daoreg,
            table: 'daos',
            json: true,
            limit: 100
        })

        console.log(JSON.stringify(dao_table, null, 2))

        assert.deepStrictEqual(dao_table.rows, [
            {
                dao_id: 1,
                dao: firstdao,
                creator: firstuser,
                ipfs: 'HASH_1',
                attributes: [
                    {
                        "first": "first attribute",
                        "second": [
                            "string", "updated attribute"
                        ]
                    },
                    {
                        "first": "second attribute",
                        "second": [
                            "string", "DAOO"
                        ]
                    }
                ],
                tokens: []
            }
        ])
        assert.deepStrictEqual(upsertattrsByCreator, true)
        assert.deepStrictEqual(upsertattrsDaoIfFound, true)
    })

    it('Deletes attributes', async function () {
        // create DAO
        await contracts.daoreg.create(
            firstdao,
            firstuser,
            'HASH_1',
            { authorization: `${firstdao}@active` }
        )

        await contracts.daoreg.upsertattrs(
            1,
            [
                { first: "first attribute", second: ['uint64', 001] },
                { first: "second attribute", second: ['string', 'DAOO'] },
                { first: "third attribute", second: ['int64', -2] },
                { first: "fourth attribute", second: ['string', 'number 4'] },
            ],
            { authorization: `${firstuser}@active` }
        )

        let deleteAttrsByCreator = true
        try {
            await contracts.daoreg.delattrs(
                1,
                ['first attribute'],
                { authorization: `${seconduser}@active` })
            deleteAttrsByCreator = false
        } catch (error) {
            assertError({
                error,
                textInside: `missing authority of ${firstuser}`,
                message: 'attributes can only be deleted by creator',
                throwError: true
            })
        }

        let deleteAttrsDaoIfFound = true
        try {
            await contracts.daoreg.upsertattrs(
                2,
                [
                    { first: "first attribute", second: ['uint64', 007] },
                    { first: "second attribute", second: ['string', 'this should fail'] },
                ],
                { authorization: `${firstuser}@active` })
            deleteAttrsDaoIfFound = false
        } catch (error) {
            assertError({
                error,
                textInside: "Organization not found",
                message: "DAO does not exists, can not be updated (expected)",
                throwError: true
            })
        }

        await contracts.daoreg.delattrs(
            1,
            ['first attribute', 'fourth attribute', 'fifth attribute'],
            { authorization: `${firstuser}@active` }
        )

        const dao_table = await rpc.get_table_rows({
            code: daoreg,
            scope: daoreg,
            table: 'daos',
            json: true,
            limit: 100
        })

        console.log(JSON.stringify(dao_table, null, 2))

        assert.deepStrictEqual(dao_table.rows, [
            {
                dao_id: 1,
                dao: firstdao,
                creator: firstuser,
                ipfs: 'HASH_1',
                attributes: [
                    {
                        "first": "second attribute",
                        "second": [
                            "string", "DAOO"
                        ]
                    },
                    {
                        "first": "third attribute",
                        "second": [
                            "int64", -2
                        ]
                    }
                ],
                tokens: []
            }
        ])
        assert.deepStrictEqual(deleteAttrsByCreator, true)
        assert.deepStrictEqual(deleteAttrsDaoIfFound, true)
    })

    it('Adds token correctly', async function () {
        // create DAO
        await contracts.daoreg.create(
            firstdao,
            firstuser,
            'HASH_1',
            { authorization: `${firstdao}@active` }
        )

        let addTokenDaoIfFound = true
        try {
            await contracts.daoreg.addtoken(
                2,
                'token.c',
                `4,CTK`,
                { authorization: `${firstuser}@active` })
            addTokenDaoIfFound= false
        } catch (error) {
            assertError({
                error,
                textInside: "Organization not found",
                message: "DAO does not exists, can not be updated (expected)",
                throwError: true
            })
        }

        let addTokenByCreator = true
        try {
            await contracts.daoreg.addtoken(
                1,
                'token.c',
                `4,CTK`,
                { authorization: `${seconduser}@active` })
            addTokenByCreator = false
        } catch (error) {
            assertError({
                error,
                textInside: `missing authority of ${firstuser}`,
                message: 'token can be added only by creator (expected)',
                throwError: true
            })
        }
      
        await contracts.daoreg.addtoken(
            1,
            'token.c',
            `4,CTK`,
            { authorization: `${firstuser}@active` }
        )

        let tokenExists = true
        try {
            await contracts.daoreg.addtoken(
                1,
                'token.c',
                `4,CTK`,
                { authorization: `${firstuser}@active` })
            tokenExists = false
        } catch (error) {
            assertError({
                error,
                textInside: 'This token symbol is already added',
                message: 'can not add a token that is already added (expected)',
                throwError: true
            })
        }

        const dao_table = await rpc.get_table_rows({
            code: daoreg,
            scope: daoreg,
            table: 'daos',
            json: true,
            limit: 100
        })

        console.log(JSON.stringify(dao_table, null, 2))
        assert.deepStrictEqual(dao_table.rows, [
            {
                dao_id: 1,
                dao: firstdao,
                creator: firstuser,
                ipfs: 'HASH_1',
                attributes: [],
                tokens: [
                    {
                        "first": "token.c",
                        "second": "4,CTK" 
                    }
                ]
            }
        ])
        assert.deepStrictEqual(addTokenDaoIfFound, true)
        assert.deepStrictEqual(addTokenByCreator, true)
        assert.deepStrictEqual(tokenExists, true)
    })

    it('Accepts deposits correctly', async () => {
       
        await contracts.daoreg.create(firstdao, firstuser, 'HASH_1', { authorization: `${firstdao}@active` })

        const [token1_contract, account1] = await createTokenContract();

        await createTokenAndTransfer(
            token1_contract, 
            account1, 
            daoreg,
            tester1,
            tester2,
            "10000.0000 DTK", 
            "4000.0000 DTK", 
            "1000.0000 DTK"
        )

        await checkBalance(account1, tester1, 'accounts', "1000.0000 DTK", "", "", "", "")
        await checkBalance(account1, tester2, 'accounts', "1000.0000 DTK", "", "", "", "")

        const [token2_contract, account2] = await createTokenContract();

        await createTokenAndTransfer(
            token2_contract,
            account2,
            daoinf,
            tester1,
            tester2,
            "10000.0000 BTK",
            "4000.0000 BTK",
            "1000.0000 BTK"
        )

        await checkBalance(account2, tester1, 'accounts', "1000.0000 BTK", "", "", "", "")
        await checkBalance(account2, tester2, 'accounts', "1000.0000 BTK", "", "", "", "")

        await contracts.daoreg.addtoken(1, account1, `4,DTK`, { authorization: `${firstuser}@active` })

        const dao_table = await rpc.get_table_rows({
            code: daoreg,
            scope: daoreg,
            table: 'daos',
            json: true,
            limit: 100
        })

        console.log(JSON.stringify(dao_table, null, 2))
        assert.deepStrictEqual(dao_table.rows, [
            {
                dao_id: 1,
                dao: 'dao.org1',
                creator: firstuser,
                ipfs: 'HASH_1',
                attributes: [],
                tokens: [
                    {
                        "first": account1,
                        "second": "4,DTK"
                    }
                ]
            }
        ])

        await checkBalance(eosio_account, tester1, 'accounts', "100.0000 TLOS", "", "", "", "")

        await eosio_token_contract.transfer(tester1, daoreg, "10.0000 TLOS", "0", { authorization: `${tester1}@active` })
        await eosio_token_contract.transfer(tester1, daoreg, "10.0000 TLOS", "0", { authorization: `${tester1}@active` })
        
        await checkBalance(eosio_account, tester1, 'accounts', "80.0000 TLOS", "", "", "", "")

        await token1_contract.transfer(tester1, daoreg, "10.0000 DTK", "1", { authorization: `${tester1}@active` })
        await token1_contract.transfer(tester1, daoreg, "25.0000 DTK", "1", { authorization: `${tester1}@active` })
        
        await checkBalance(account1, tester1, 'accounts', "965.0000 DTK", "", "", "", "")

        let _table = await rpc.get_table_rows({
            code: daoreg,
            scope: tester1,
            table: 'balances',
            json: true,
            limit: 100
        })
        assert.deepStrictEqual(_table.rows, [
            {
                id: 0,
                available: "20.0000 TLOS",
                locked: "0.0000 TLOS",
                dao_id: 0,
                token_account: "eosio.token"
            },
            {
                id: 1,
                available: "35.0000 DTK",
                locked: "0.0000 DTK",
                dao_id: 1,
                token_account: account1
            }
        ])
  
        let memoNotEmpty = true
        try{ 
            await token1_contract.transfer(tester1, daoreg, "10.0000 DTK", "", { authorization: `${tester1}@active` })
            memoNotEmpty = false
        } catch (error) {
            assertError({
                error,
                textInside: 'Memo can not be empty, especify dao_id',
                message: 'Fails if memo is empty (expected)',
                throwError: true
            })        
        }

        let systemTokenNotSupported = true
        try {
            await token2_contract.transfer(tester1, daoreg, "10.0000 BTK", "0", { authorization: `${tester1}@active` })
            systemTokenNotSupported = false
        } catch (error) {
            assertError({
                error,
                textInside: 'This is not a supported system token',
                message: 'Fails if if is not a supported system token (expected)',
                throwError: true
            })
        }

        let tokenNotSupportedByDao = true
        try {
            await token2_contract.transfer(tester1, daoreg, "10.0000 BTK", "1", { authorization: `${tester1}@active` })
            tokenNotSupportedByDao = false
        } catch (error) {
            assertError({
                error,
                textInside: ' Token is not supported by a registred Dao',
                message: 'Fails if if is not a supported system token (expected)',
                throwError: true
            })
        }

        let daoIdPositiveNumber = true
        try {
            await eosio_token_contract.transfer(tester1, daoreg, "10.0000 TLOS", "-1", { authorization: `${tester1}@active` })
            daoIdPositiveNumber = false
        } catch (error) {
            assertError({
                error,
                textInside: 'Dao id has to be a positive number',
                message: 'Fails if Dao_id is not a positive number (expected)',
                throwError: true
            })
        }

        let organizationNotFound = true
        try {
            await eosio_token_contract.transfer(tester1, daoreg, "10.0000 TLOS", "2", { authorization: `${tester1}@active` })
            organizationNotFound = false
        } catch (error) {
            assertError({
                error,
                textInside: 'Organization not found',
                message: 'Fails if Dao is not registered (expected)',
                throwError: true
            })
        }

        let tokenIsNotSupported = true
        try {
            await token2_contract.transfer(tester1, daoreg, "10.0000 BTK", "1", { authorization: `${tester1}@active` })
            tokenIsNotSupported = false
        } catch (error) {
            assertError({
                error,
                textInside: 'Token is not supported by a registred Dao',
                message: 'Fails if the token is not supported (expected)',
                throwError: true
            })
        }

        assert.deepStrictEqual(tokenNotSupportedByDao, true)
        assert.deepStrictEqual(memoNotEmpty, true)
        assert.deepStrictEqual(systemTokenNotSupported, true)
        assert.deepStrictEqual(daoIdPositiveNumber, true)
        assert.deepStrictEqual(organizationNotFound, true)
        assert.deepStrictEqual(tokenIsNotSupported, true)

    })

    it('Allows to withdraw correctly', async () => {

        await contracts.daoreg.create(firstdao, firstuser, 'HASH_1', { authorization: `${firstdao}@active` })

        const [token1_contract, account1] = await createTokenContract();

        await createTokenAndTransfer(
            token1_contract,
            account1,
            daoreg,
            tester1,
            tester2,
            "10000.0000 DTK",
            "4000.0000 DTK",
            "1000.0000 DTK"
        )

        await contracts.daoreg.addtoken(1, account1, `4,DTK`, { authorization: `${firstuser}@active` })
        
        await checkBalance(eosio_account, tester1, 'accounts', "80.0000 TLOS", "", "", "", "")

        await eosio_token_contract.transfer(tester1, daoreg, "30.0000 TLOS", "0", { authorization: `${tester1}@active` })

        await checkBalance(daoreg, tester1, 'balances', "30.0000 TLOS", "0.0000 TLOS", 0, 0, 'eosio.token')
        await checkBalance(eosio_account, tester1, 'accounts', "50.0000 TLOS", "", "", "", "")        
        await checkBalance(account1, tester1, 'accounts', "1000.0000 DTK", "", "", "", "")

        await token1_contract.transfer(tester1, daoreg, "20.0000 DTK", "1", { authorization: `${tester1}@active`})
        
        await checkBalance(account1, tester1, 'accounts', "980.0000 DTK", "", "", "", "")

        let _table = await rpc.get_table_rows({
            code: daoreg,
            scope: tester1,
            table: 'balances',
            json: true,
            limit: 100
        })
        assert.deepStrictEqual(_table.rows, [
            {
                id: 0,
                available: "30.0000 TLOS",
                locked: "0.0000 TLOS",
                dao_id: 0,
                token_account: "eosio.token"
            },
            {
                id: 1,
                available: "20.0000 DTK",
                locked: "0.0000 DTK",
                dao_id: 1,
                token_account: account1
            }
        ])

        await contracts.daoreg.withdraw(tester1, eosio_account, "10.0000 TLOS", {authorization: `${tester1}@active`})
        await contracts.daoreg.withdraw(tester1, account1, "10.0000 DTK", {authorization: `${tester1}@active`})

        _table = await rpc.get_table_rows({
            code: daoreg,
            scope: tester1,
            table: 'balances',
            json: true,
            limit: 100
        })
        assert.deepStrictEqual(_table.rows, [
            {
                id: 0,
                available: "20.0000 TLOS",
                locked: "0.0000 TLOS",
                dao_id: 0,
                token_account: "eosio.token"
            },
            {
                id: 1,
                available: "10.0000 DTK",
                locked: "0.0000 DTK",
                dao_id: 1,
                token_account: account1
            }
        ])

        await checkBalance(eosio_account, tester1, 'accounts', "60.0000 TLOS", "", "", "", "")
        await checkBalance(account1, tester1, 'accounts', "990.0000 DTK", "", "", "", "")

        let withdrawMoreThanBalance = true
        try {
            await contracts.daoreg.withdraw(tester1, eosio_account, "100.0000 TLOS", { authorization: `${tester1}@active` })
            withdrawMoreThanBalance = false
        } catch (error) {
            assertError({ 
                error,
                textInside: "You do not have enough balance",
                message: "User can not withdraw more than its own balance (expected)",
                throwError: true
            })
        }
    
        let withdrawNonExitingToken = true
        try {
            await contracts.daoreg.withdraw(tester1, eosio_account, "100.0000 BTK", { authorization: `${tester1}@active` })
            withdrawNonExitingToken = false
        } catch (error) {
            assertError({
                error,
                textInside: "Token account and symbol are not registered in your account",
                message: "Cannot withdraw a token that the user does not own (expected)",
                throwError: true
            })
        }
        
        let withdrawZeroAmount = true
        try {
            await contracts.daoreg.withdraw(tester1, account1, "0.0000 DTK", { authorization: `${tester1}@active` })
            withdrawZeroAmount = false
        } catch (error) {
            assertError({
                error,
                textInside: "Amount to withdraw has to be higher than zero",
                message: "Amount to withdraw has to be higher than zero (expected)",
                throwError: true
            })
        }

        assert.deepStrictEqual(withdrawZeroAmount, true)
        assert.deepStrictEqual(withdrawMoreThanBalance, true)
        assert.deepStrictEqual(withdrawNonExitingToken, true)
    })

    it('Reset settings', async () => {
        await contracts.daoreg.resetsttngs({ authorization: `${daoreg}@active` })

        let resetByDaoreg = true
        try {
            await contracts.daoreg.resetsttngs(
                { authorization: `${firstuser}@active` })
            resetByDaoreg = false
        } catch (error) {
            assertError({
                error,
                textInside: `missing authority of ${daoreg}`,
                message: 'users can not reset settings (expected)',
                throwError: true
            })
        }

        const dao_table = await rpc.get_table_rows({
            code: daoreg,
            scope: daoreg,
            table: 'daos',
            json: true,
            limit: 100
        })

        assert.deepStrictEqual(dao_table.rows, [])
        assert.deepStrictEqual(resetByDaoreg, true)
    })
})