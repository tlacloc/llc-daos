const assert = require('assert')
const { rpc } = require('../scripts/eos')
const { getContracts, getAccountBalance } = require('../scripts/eosio-util')
const { daosAccounts } = require('../scripts/daos-util')
const { assertError } = require('../scripts/eosio-errors')
const { contractNames, isLocalNode, sleep } = require('../scripts/config')
const { setParamsValue } = require('../scripts/contract-settings')
const { AssertionError } = require('assert')

const { daoreg, daoinf } = contractNames
const { firstuser, seconduser, thirduser, fourthuser, firstdao, seconddao } = daosAccounts

describe('Dao registry', async function () {
    let contracts;
    let daousers;

    before(async function () {
        if (!isLocalNode()) {
            console.log('These test should only be run on local node')
            process.exit(1)
        }
        contracts = await getContracts([daoreg])
        daousers = [firstuser, seconduser, thirduser]
        await setParamsValue()
    })

    beforeEach(async function () {
        await contracts.daoreg.reset({ authorization: `${daoreg}@active` })
    })

    it('Settings, set a new param', async function () {
        await contracts.daoreg.setparam(
            'testparam',
            ['uint64', 20],
            'test param',
            { authorization: `${daoreg}@active` }
        )

        const settingParam = await rpc.get_table_rows({
            code: daoreg,
            scope: daoreg,
            table: 'config',
            json: true,
            limit: 100
        })
        console.log(JSON.stringify(settingParam, null, 2))

        // aqui tambien asserts
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
                textInside: `dao with same name already registered`,
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

        // DAO cannot be updated by someone else
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

        // Fails if DAO is not found
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

        // Fails if DAO is not found
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

        // delete DAO
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

        // add-modify attributes can only be done by creator 
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

        // Fails if DAO is not found
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

        // add some attributes
        await contracts.daoreg.upsertattrs(
            1,
            [
                { first: "first attribute", second: ['uint64', 001] },
                { first: "second attribute", second: ['string', 'DAOO'] },
            ],
            { authorization: `${firstuser}@active` }
        )

        // update attribute
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

        // add some attributes
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
        // attributes can only be deleted by creator
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

        // Fails if DAO is not found
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

        // delete attributes, fifth attribute does not exists
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

        // Fails if DAO is not found
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

        // add token can be done only by creator
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

        // add token
        await contracts.daoreg.addtoken(
            1,
            'token.c',
            `4,CTK`,
            { authorization: `${firstuser}@active` }
        )

        // add token can not be done if the token is already added
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

    it('Reset settings', async function () {
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