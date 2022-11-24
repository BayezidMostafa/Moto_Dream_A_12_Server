require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000

// Middleware
app.use(cors());
app.use(express.json())
const uri = process.env.URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const run = async () => {
    try {
        const categoryCollection = client.db('motoDreamDB').collection('category')
        const categoryItemsCollection = client.db('motoDreamDB').collection('products')
        app.get('/category', async (req, res) => {
            const query = {};
            const category = await categoryCollection.find(query).toArray();
            res.send(category);
        })
        app.get('/category/:id', async(req, res)=> {
            const id = req.params.id;
            const query = {
                categoryId: id
            }
            const products = await categoryItemsCollection.find(query).toArray()
            res.send(products);
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