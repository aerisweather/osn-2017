const Redis = require("ioredis");

class RedisDataFlow {

	constructor(opts) {
		// Redis setup
		this.redisClient = new Redis(opts);
		this.redisClient.on("error", function (err) {
			console.log("Error " + err);
		});

		// Bonus! We can define "stored procedures" (lua scripts) on the server to get things all at once
		// - This will find our ID in our custom "index" and grab it's entire object from the hash map stored at that key.
		/*this.redisClient.defineCommand('findLatest', {
			numberOfKeys: 1,
			lua: `return redis.call('HGETALL', unpack(redis.call('ZREVRANGEBYSCORE', KEYS[1], '+inf', '-inf', 'LIMIT', '0', '1')))`
		})*/
	}

	save(message) {
		const pipeline = this.redisClient.pipeline();
		// Save main message hash map
		pipeline.hmset(getMessageId(message), message);
		// Add to our index of type:imageId sorted by dateCreated, we need to search by this later.
		pipeline.zadd(`${message.type}:${message.imageId}`, message.dateCreated, getMessageId(message));
		return pipeline.exec();
	}

	findLatest({type, imageId}) {
		return this.redisClient.zrevrangebyscore(`${type}:${imageId}`, '+inf', '-inf', 'LIMIT', '0', '1')
			.then(key => this.redisClient.hgetall(key));

		// Bonus! We can use the "stored procedure" we defined earlier, and get all the data at once:
		/*return this.redisClient.findLatest(`${type}:${imageId}`)
		 	.then(transformArrayToObj)*/
	}

	findSince({type, imageId}, sinceTime, limit) {
		if(limit === undefined) {
			limit = '99'
		}
		return this.redisClient.zrevrangebyscore(`${type}:${imageId}`, '+inf', sinceTime, 'LIMIT', '0', limit)
			.then(resultKeys => {
				return Promise.all(
					resultKeys.map(key => this.redisClient.hgetall(key))
				)
			});
	}
}

function getMessageId(message) {
	return `${message.type}:${message.dateCreated}`;
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