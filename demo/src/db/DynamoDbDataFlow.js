const AWS = require('aws-sdk');
const DynamoDb = AWS.DynamoDB;

/*
 TableName: osn2017-aeris
 Primary Key: id: S, dateCreated: N
 Secondary Index: type: S, validTime: N
 Read/Write capacity: 5 and 5 (25/mo is free)
 */

AWS.config.update({
	region:   'us-east-1',
	endpoint: "http://localhost:9005"
});

var dynamodb = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();

const table = "osn2017-aeris-dataflow";

(async () => {
	try {
		const tableInfo = await dynamodb.describeTable({TableName: table}).promise();
	}
	catch (err) {
		console.error("Table doesn't exist yet. Creating...");
		await provisionTable(table);
	}
})();

class DynamoDbDataFlow {

	constructor() {

	}

	async save(message) {
		message['typeImageId'] = `${message.type}:${message.imageId}`;
		return await dynamodb.putItem({
			TableName: table,
			Item: message,
			ReturnedValues: 'NONE',

		}).promise()
	}

	async findLatestValidTime({type, imageId}) {
		const params = {
			TableName: table,
			IndexName: 'typeImageId-validTime-index',
			ConsistentRead: true,
			Limit: 1,
			KeyConditionExpression: 'typeImageId = :typeImageId',
			ExpressionAttributeValues: { ':typeImageId': {'S': `${type}:${imageId}`}},
			ScanIndexForward: false
		};
		return dynamodb.query(params).promise();
	}

	async findByValidTime({type, imageId, minValidTime = Number.MIN_SAFE_INTEGER, maxValidTime = Number.MAX_SAFE_INTEGER, limit = 99}) {
		const params = {
			TableName: table,
			IndexName: 'typeImageId-validTime-index',
			Limit: limit,
			KeyConditionExpression: 'typeImageId = :typeImageId AND validTime BETWEEN :minValidTime AND :maxValidTime',
			ExpressionAttributeValues: {
				':typeImageId': {S: `${type}:${imageId}`},
				':minValidTime': {N: minValidTime.toString()},
				':maxValidTime': {N: maxValidTime.toString()}
			},
			ScanIndexForward: false
		};
		return dynamodb.query(params).promise();
	}
}

module.exports = DynamoDbDataFlow;


async function provisionTable(table) {
	const params = {
		TableName:             table,
		KeySchema:             [
			{AttributeName: "type", KeyType: "HASH"},  //Partition key
			{AttributeName: "dateCreated", KeyType: "RANGE"}  //Sort key
		],
		AttributeDefinitions:  [
			{AttributeName: "type", AttributeType: "S"},
			{AttributeName: "dateCreated", AttributeType: "N"},
			{AttributeName: "typeImageId", AttributeType: "S"},  //Partition key
			{AttributeName: "validTime", AttributeType: "N"}
		],
		GlobalSecondaryIndexes: [
			{
				IndexName: "typeImageId-validTime-index",
				KeySchema:             [
					{AttributeName: "typeImageId", KeyType: "HASH"},  //Partition key
					{AttributeName: "validTime", KeyType: "RANGE"}  //Sort key
				],
				Projection: {
					ProjectionType: "ALL"
				},
				ProvisionedThroughput: {
					ReadCapacityUnits:  5,
					WriteCapacityUnits: 5
				}
			}
		],
		ProvisionedThroughput: {
			ReadCapacityUnits:  5,
			WriteCapacityUnits: 5
		}
	};
	await dynamodb.createTable(params).promise();

	await new Promise((resolve, reject) => {
		let timeout = setInterval(async () => {
			try {
				const tableInfo = await dynamodb.describeTable({TableName: table}).promise();
				if (tableInfo && tableInfo.Table && tableInfo.Table.TableStatus === 'ACTIVE') {
					clearInterval(timeout);
					resolve();
				}
			}
			catch (err) {
				clearInterval(timeout);
				reject(err);
			}
		}, 1000);
	})
}