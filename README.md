# eureka-sidecar

A co-hosted process for RainMakr microservices. The sidecar will check
a local HTTP(S) endpoint to ensure that a REST microservice is healthy.
Upon successfull healthcheck the service will be registered with service 
discovery server (Eureka)