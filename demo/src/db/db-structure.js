const flatten = require('flat');
const Redis = require("ioredis");

// Redis setup
const redisClient = new Redis();
redisClient.on("error", function (err) {
	console.log("Error " + err);
});


const message = {
	type:        'please-create-thumbnail',
	dateCreated: new Date(),
	target:      'thumbnail-creator',
	// Payload
	imageId:     'radar-mn',
	validTime:   new Date('2017-05-25T06:00:00Z'),
	width:       100,
	height:      100,
	location:    's3://aeris-osn2017/image-ingestor'
};

function getMessageId(message) {
	return `${message.type}:${message.dateCreated.getTime()}`;
}

// Saving and fetching a message (note all values are saved and returned as strings)
redisClient.hmset(getMessageId(message), message)
	.then(() => {
		console.log(`Done ${getMessageId(message)}`);
		return redisClient.hgetall(getMessageId(message))
	})
	.then(results => {
		console.log(`Fetch results:`, results);
	});

redisClient.zadd(`${message.type}:${message.imageId}`, message.dateCreated.getTime(), getMessageId(message));

/*
const primaryKey = message.type + message.dateCreated.getTime();


// Also maintain a set for our search
const querySet = message.type + message.payload.imageId;
const queryScore = message.payload.validTime;
const queryValue = primaryKey;*/

