require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000
const jwt = require('jsonwebtoken')

const stripe = require("stripe")(process.env.SECRET_STRIPE_KEY);

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
        const paidCollection = client.db('motoDreamDB').collection('paidProducts')

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
        app.get('/myProducts/:email', async (req, res) => {
            const email = req.params.email;
            const query = {
                seller_email: email
            }
            const products = await categoryItemsCollection.find(query).toArray()
            res.send(products);
        })
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
        app.get('/myorders/:email', async (req, res) => {
            const email = req.params.email
            const filter = { email: email }
            const result = await bookedCollection.find(filter).toArray();
            res.send(result)
        })
        app.get('/myorder/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await bookedCollection.findOne(filter);
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
        app.post('/addProduct', async (req, res) => {
            const product = req.body;
            const result = await categoryItemsCollection.insertOne(product);
            res.send(result);
        })
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ admin: user?.role === 'admin' });
        })
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ seller: user?.role === 'seller' });
        })
        app.put('/advertisement/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    advertisement: true
                }
            }
            const result = await categoryItemsCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })
        app.get('/advertised', async (req, res) => {
            const filter = {
                advertisement: true
            }
            const result = await categoryItemsCollection.find(filter).toArray();
            res.send(result)
        })
        app.post('/create-payment-intent', async (req, res) => {
            const order = req.body;
            const price = order.price;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });
        app.post('/payments', async (req, res) => {
            const paymentData = req.body;
            const result = await paidCollection.insertOne(paymentData);
            const id = paymentData.orderId;
            const filter = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionID: paymentData.transactionID
                }
            }
            const updateResult = await bookedCollection.updateOne(filter, updatedDoc);
            res.send(updateResult)
        })
        app.put('/updateproductstatus/:bookingId', async (req, res) => {
            const bookingId = req.params.bookingId;
            const filter = { _id: ObjectId(bookingId) };
            const options = { upsert: true }
            const updatedDoc = {
                $set: {
                    product_status: 'sold',
                    advertisement: false
                }
            }
            const result = await categoryItemsCollection.updateOne(filter, updatedDoc, options)
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