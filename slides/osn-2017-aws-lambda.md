class: left, middle, slide-title

# Using AWS Lambda to Create Weather GIFs

## .subtitle[Seth Miller and Edan Schwartz]

#### .inline-logo[![AW Logo](./images/aeris-weather-logo.png)] Sponsored By: AerisWeather

???
Good luck! We got this!
---
class: slide-secondary

# What is Lambda? (Real Quick!)

1. Functional and Stateless Compute - Give it code and an input
	1. Reacts to various AWS events
	1. DB Inserts via DynamoDB
	1. API Events via API Gateway
--
count: false
1. Charged per 100ms used at CPU/RAM levels
	1. EC2 is hourly
--
count: false
1. No Ops - Manage only code
--
count: false

	1. ... and VPC
	1. ... and Security Groups
	1. ... and Triggers
	1. ... and Env Config
--
count: false

.summary["No OPs" is really more like "Less OPs"]
???
Just as a quick overview

---
class: slide-secondary
# What is Lambda good for?

1. Batch Processing
	1. Massively parallel - 100 concurrent by default
1. Small Compute
	1. Charged in 100ms increments
	1. No idling EC2 Server
1. Spikey Workloads

---
class: slide-primary

# Our Needs

1. Fine grained usage based pricing
	1. Large data sets coming in hourly, every 6 hours
	1. Idle resources
	1. Different than low usage API as seen before
	1. Hard to scale up/down preemptively
???
Forecasts primary motivator
Timers kind of work but off hour still paying for hour
--
count: false
1. Parallel processing jobs
	1. Each should finish < 30 seconds
	1. Time to market is important for our customers
	
--
count: false
1. Reference old data, combine new data
	1. More than just a pipeline
	1. Forking and data re-use
--
count: false

.summary[Need: Very scalable compute solution, only charged us for time used, even less than an hour.]

???
What drove us to Lambda
---
class: slide-primary
# Why did we choose Lambda?

1. Massive concurrency
	1. Can spin up thousands of cores - Time to Market
1. We have Spikey Workloads!
	1. Fine grained cost helps a lot - sub hourly
1. Metrics for each Lambda function
	1. CloudWatch dashboards
1. Competitors
	1. Google Cloud Functions – Still in Beta
	1. Windows Azure Functions – It isn't AWS
	1. Open Whisk – Uses containers, cool, not a lot of support
	
---
class: left, middle, slide-title-alt
# Data Flow Pattern .inline-icon[![Data Flow Icon](./images/data-flow-icon.svg)]
## Coordinating microservices (like Lambda)

---
name:data-flow-pattern
# Data Flow Pattern
## A smart way to handle microservices

1. Based on Simple Workflow Service
	1. SWS didn't really seem "Simple"
	1. Verbose config for each thing
	1. Forking workflows difficult
1. Why Data Flow?
	1. Need more advanced Workflows
	1. Microservice coordination

---
class: slide-primary
# Data Flow Architecture

1. Smart Mediator - The Brains .img-float-right[.size-height-150px[![Mediator](./images/diagrams/mediator.svg)]]
	1. Config lives
	1. Decider
	1. DB Requests
	1. Outputs messages to all workers
--
count: false

1. Dumb Workers - "Pure" Functions .img-float-right[.size-height-150px[![Worker](./images/diagrams/worker.svg)]]
	1. Take in single type of message
	1. Do work described in message
	1. Output result description back to mediator
	
.summary[A smart mediator leads dumb workers, update independently]
	
---
class: left, middle, slide-title-alt
# Demo .inline-icon[![Data Flow Icon](./images/data-flow-icon.svg)]
## AWS Lambda - Creating Weather GIFs

---
class: slide-secondary
# Demo - Design

## We want a gif and thumbnails
1. Download each frame image 
1. For each image create a thumbnail
1. Once we have all frames, create weather gif

---
class: slide-secondary
# Demo - Design

.center[.size-height-600px[![Data Flow Icon](./images/diagrams/demo-full.svg)]]

---

# Questions?

### Slides and demo code available online: http://github.com/aerisweather

#### .inline-logo[![AW Logo](./images/aeris-weather-logo.png)] Sponsored By: AerisWeather
#### Free Demo Accounts API and Maps: https://aerisweather.com

## Thanks!

### Seth Miller https://github.com/four43
### Edan Schwartz https://github.com/eschwartz