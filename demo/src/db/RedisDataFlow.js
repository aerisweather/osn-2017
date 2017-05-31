const Redis = require("ioredis");

class RedisDataFlow {

	constructor(opts) {
		// Redis setup
		this.redisClient = new Redis(opts);
		this.redisClient.on("error", function (err) {
			console.error("Redis error " + err);
		});

		// Bonus! We can define "stored procedures" (lua scripts) on the server to get things all at once
		// - This will find our ID in our custom "index" and grab it's entire object from the hash map stored at that key.
		/*this.redisClient.defineCommand('findLatest', {
			numberOfKeys: 1,
			lua: `return redis.call('HGETALL', unpack(redis.call('ZREVRANGEBYSCORE', KEYS[1], '+inf', '-inf', 'LIMIT', '0', '1')))`
		})*/
	}

	async save(message) {
		const pipeline = this.redisClient.pipeline();

		// Save the message to a hash map
		// keyed by message id (type + validTime)
		pipeline.hmset(getMessageId(message), message);

		// Save the message to a sorted set
		// Keyed by sortId (type + imageId)
		// and sorted by validTime
		// This will allow us to search by validTime, later
		if (Number.isInteger(message.validTime)) {
			pipeline.zadd(getSortId(message), message.validTime, getMessageId(message));
		}

		return pipeline.exec();
	}

	async findByValidTime({type, imageId, minValidTime, maxValidTime, limit = 99}) {
		// Find the ids for all messages
		// since minValidTime
		const messageIds = await this.redisClient
			.zrevrangebyscore(
				getSortId({type, imageId}),
				maxValidTime || '+inf', minValidTime || '-inf',
				'LIMIT', '0', limit
			);

		// Lookup the messages, by id
		const messages = await Promise.all(
			messageIds.map(
				msgId => this.redisClient.hgetall(msgId)
			)
		);

		return messages;
	}
}

function getMessageId(message) {
	return `${message.type}:${message.dateCreated}`;
}

function getSortId({type, imageId}) {
	return `${type}:${imageId}`;
}

function transformArrayToObj(arrResponse) {
	if (Array.isArray(arrResponse)) {
		let obj = {};
		for (let i = 0; i < arrResponse.length; i += 2) {
			obj[arrResponse[i]] = arrResponse[i + 1];
		}
		return obj;
	}
	return arrResponse;
}
module.exports = RedisDataFlow;