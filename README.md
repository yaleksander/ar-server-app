# Directional Light Vector Estimation From a Virtual AR Object and its 2D Shadow Mask

This is the Node.js implementation of the SVR 2025 paper [Directional Light Vector Estimation From a Virtual AR Object and its 2D Shadow Mask](). The method described in the paper is divided into a simple AR user interface and a server application. The user sends information about the AR scene to the server, which constructs the middle data and runs the aforementioned method to retrieve the directional light vector. This ensures the hard processing is done exclusively on the server side. The server then sends back to the user a single normalized vector representing the directional light direction.

## Requirements

The requirements for the server side are the same as ARShadowGAN, which is used to create the initial shadow mask, plus Node.js.

* CUDA (9.0)
* cuDNN (7.4.1)
* tensorflow-gpu (1.12.0)
* opencv-python (4.1.1.26)
* numpy (1.16.5)
* python (3.5.4)
* Node.js (16.0.0)

This code has been tested under Windows 10 and Ubuntu 22.04 successfully with all the requirements and dependencies.

## The code

The implementation of the method described in the paper comprises mostly of the following files:

```
threejs/client.js
server.js
client.js
arshadowgan/getShadow.py
```

## The dataset

The dataset mentioned in the paper can be found inside `threejs/my-images`.
