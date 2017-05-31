const RedisDataFlow = require("./RedisDataFlow");

const messages = [
	{
		type:        'please-create-thumbnail',
		target:      'thumbnail-creator',
		// Payload
		imageId:     'radar-mn',
		validTime:   new Date(600).getTime(),
		width:       100,
		height:      100,
		location:    's3://aeris-osn2017/image-ingestor/radar-mn/6'
	},
	{
		type:        'please-create-thumbnail',
		target:      'thumbnail-creator',
		// Payload
		imageId:     'satellite-ca',
		validTime:   new Date(600).getTime(),
		width:       100,
		height:      100,
		location:    's3://aeris-osn2017/image-ingestor/satellite-ca/6'
	},
	{
		type:        'did-create-thumbnail',
		target:      'thumbnail-creator',
		// Payload
		imageId:     'radar-mn',
		validTime:   new Date(600).getTime(),
		width:       100,
		height:      100,
		location:    's3://aeris-osn2017/thumbnail-creator/radar-mn/6'
	},
	{
		type:        'did-create-thumbnail',
		target:      'thumbnail-creator',
		// Payload
		imageId:     'satellite-ca',
		validTime:   new Date(600).getTime(),
		width:       100,
		height:      100,
		location:    's3://aeris-osn2017/thumbnail-creator/satellite-ca/6'
	},
	{
		type:        'did-create-thumbnail',
		target:      'thumbnail-creator',
		// Payload
		imageId:     'radar-mn',
		validTime:   new Date(700).getTime(),
		width:       100,
		height:      100,
		location:    's3://aeris-osn2017/thumbnail-creator/radar-mn/7'
	},
	{
		type:        'did-create-thumbnail',
		target:      'thumbnail-creator',
		// Payload
		imageId:     'radar-mn',
		validTime:   new Date(800).getTime(),
		width:       100,
		height:      100,
		location:    's3://aeris-osn2017/thumbnail-creator/radar-mn/8'
	}
];

const client = new RedisDataFlow();

messages.reduce((savePromise, message) => {
	return savePromise.then(() => client.save(message));
}, Promise.resolve())
	.then(() => {
		return client.findSince({
			type:    'did-create-thumbnail',
			imageId: 'radar-mn'
		}, 600)
	})
	.then(result => {
		console.log(JSON.stringify(result, null, 2));
		process.exit(0);
	})
	.catch(console.error);

/*
 const primaryKey = message.type + message.dateCreated.getTime();


 // Also maintain a set for our search
 const querySet = message.type + message.payload.imageId;
 const queryScore = message.payload.validTime;
 const queryValue = primaryKey;*/

