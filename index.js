require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000
const jwt = require('jsonwebtoken')
const app = express();

// Middleware
app.use(cors());
app.use(express.json())
const uri = process.env.URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// JWT Middleware
const verifyJWTAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    console.log('From auth header', authHeader);
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized Access' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.SECRET_ACCESS_TOKEN, (error, decoded) => {
        if (error) {
            res.status(403).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded;
        next()
    })
}


const run = async () => {
    try {
        // DB Collections
        const categoryCollection = client.db('motoDreamDB').collection('category')
        const categoryItemsCollection = client.db('motoDreamDB').collection('products')
        const usersCollection = client.db('motoDreamDB').collection('users')
        const bookedCollection = client.db('motoDreamDB').collection('bookedProducts')

        // Admin Verifications
        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = {
                email: decodedEmail
            }
            const user = await usersCollection.findOne(query)
            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'Forbidden Access' })
            }
            next()
        }

        // Seller verifications
        const verifySeller = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail }
            const user = await usersCollection.findOne(query)
            if (user?.role !== 'seller') {
                return res.status(403).send({ message: 'Forbidden Access' })
            }
            console.log('seller true');
            next()
        }


        // JWT AUTHORIZATION
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email }
            const options = { upsert: true };
            const updateDoc = {
                $set: user
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign(user, process.env.SECRET_ACCESS_TOKEN, { expiresIn: '5d' })
            return res.send({ result, token })

        })

        app.get('/category', async (req, res) => {
            const query = {};
            const category = await categoryCollection.find(query).toArray();
            res.send(category);
        })
        app.get('/category/:category_name', async (req, res) => {
            const category_name = req.params.category_name;
            const query = {
                category_name: category_name
            }
            const products = await categoryItemsCollection.find(query).toArray()
            res.send(products);
        })
        // app.post('/category', async (req, res) => {
        //     const user = req.body;
        //     const result = await categoryItemsCollection.insertOne(user);
        //     res.send(result);
        // })
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })
        app.post('/bookedProducts', async (req, res) => {
            const product = req.body;
            const result = await bookedCollection.insertOne(product);
            res.send(result);
        })
        app.get('/users', async (req, res) => {
            const query = {}
            const user = await usersCollection.find(query).toArray()
            res.send(user)
        })
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email });
            res.send(user)
        })
        app.post('/addProduct', async(req, res) => {
            const product = req.body;
            const result = await categoryItemsCollection.insertOne(product);
            res.send(result);
        })
    }
    catch { }
    finally { }
}
run().catch(err => console.error(err));
app.get('/', (req, res) => {
    res.send('Server is running')
})

app.listen(port, () => {
    console.log(`Server is running http://localhost:${port}`);
})