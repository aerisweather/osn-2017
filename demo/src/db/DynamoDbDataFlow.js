const AWS = require('aws-sdk');

class DynamoDbDataFlow {

	constructor(opts) {
		this.tableName = opts.TableName;
		this.docClient = new AWS.DynamoDB.DocumentClient(opts);
	}

	async save(message) {
		message['typeImageId'] = `${message.type}:${message.imageId}`;
		return await this.docClient.put({
			TableName: this.tableName,
			Item: message,
			ReturnedValues: 'NONE'
		}).promise()
	}

	async findLatestValidTime({type, imageId}) {
		const params = {
			TableName: this.tableName,
			IndexName: 'typeImageId-validTime-index',
			Limit: 1,
			KeyConditionExpression: 'typeImageId = :typeImageId',
			ExpressionAttributeValues: { ':typeImageId': `${type}:${imageId}`},
			ScanIndexForward: false
		};
		const results = await this.docClient.query(params).promise();
		return results.Items[0];
	}

	async findByValidTime({type, imageId, minValidTime = Number.MIN_SAFE_INTEGER, maxValidTime = Number.MAX_SAFE_INTEGER, limit = 99}) {
		const params = {
			TableName: this.tableName,
			IndexName: 'typeImageId-validTime-index',
			Limit: limit,
			KeyConditionExpression:
				'typeImageId = :typeImageId AND' +
				'validTime BETWEEN :minValidTime AND :maxValidTime',
			ExpressionAttributeValues: {
				':typeImageId': `${type}:${imageId}`,
				':minValidTime': minValidTime,
				':maxValidTime': maxValidTime
			},
			ScanIndexForward: false
		};
		const results = await this.docClient.query(params).promise();
		return results.Items;
	}
}

module.exports = DynamoDbDataFlow;