const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config()
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cookieParser = require('cookie-parser')

const corsOptions = {
  origin: ['http://localhost:5173', 'https://shelf-bookm.netlify.app'],
  credentials: true,
  optionalSuccessStatus: 200,
}

app.use(cors(corsOptions))
app.use(express.json());
app.use(cookieParser())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wmzdc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// verifyToken
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token
  if (!token) return res.status(401).send({ message: 'unauthorized access' })
  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
  })

  next()
}

async function run() {
  try {

    const booksCollection = client.db('booksPortal').collection('books');
    const categoriesCollection = client.db('booksPortal').collection('category');
    const borrowBooks = client.db('booksPortal').collection('borrowed');
    // await booksCollection.updateMany(
    //   { "quantity": { $type: "string" } },
    //   [
    //     { $set: { "quantity": { $toInt: "$quantity" } } }
    //   ]
    // );

    // generate jwt
    app.post('/jwt', async (req, res) => {
      const email = req.body
      // create token
      const token = jwt.sign(email, process.env.SECRET_KEY, {
        expiresIn: '365d',
      })
      console.log(token)
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })

    // logout 
    app.get('/logout', async (req, res) => {
      res
        .clearCookie('token', {
          maxAge: 0,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })
    
    app.post("/books", verifyToken, async (req, res) => {
        const newBook = req.body;
        try {
          const result = await booksCollection.insertOne(newBook);
          res.status(201).send({ success: true, message: "Book added successfully", result });
        } catch (error) {
          res.status(500).send({ success: false, message: "Failed to add book", error });
        }
      });

      app.get("/books", verifyToken, async (req, res) => {
        try {
          const books = await booksCollection.find({}).toArray(); 
          res.json(books);
        } catch (error) {
          res.status(500).json({ error: "Failed to fetch books" });
        }
      });

      app.get("/books/:id", verifyToken, async (req, res) => {
        try {
          const bookId = req.params.id;
      
          if (!ObjectId.isValid(bookId)) {
            return res.status(400).json({ error: "Invalid book ID" });
          }
      
          const book = await booksCollection.findOne({ _id: new ObjectId(bookId) });
      
          if (!book) {
            return res.status(404).json({ error: "Book not found" });
          }
      
          res.json(book);
        } catch (error) {
          console.error("Error fetching book details:", error);
          res.status(500).json({ error: "Failed to fetch book details" });
        }
      });

      // Update book
    app.put('/books/:id', verifyToken, async (req, res) => {
        const bookId = req.params.id;
        const { name, authorName, category, rating, image } = req.body;
  
        try {
          const updatedBook = {
            name,
            authorName,
            category,
            rating,
            image,
          };
  
          const result = await booksCollection.updateOne(
            { _id: new ObjectId(bookId) },
            { $set: updatedBook }
          );
  
          if (result.modifiedCount === 0) {
            return res.status(404).json({ error: "Book not found or no changes made" });
          }
  
          res.json({ success: true, message: "Book updated successfully" });
        } catch (error) {
          res.status(500).json({ error: "Failed to update book" });
        }
      });

      app.get("/category", async (req, res) => {
        try {
          const categories = await categoriesCollection.find({}).toArray();
          res.json(categories);
        } catch (error) {
          res.status(500).json({ error: "Failed to fetch categories" });
        }
      });

      app.get("/books/category/:category", async (req, res) => {
        try {
          const { category } = req.params; 
      
          const query = { category: category }; 
      
          const books = await booksCollection.find(query).toArray();
      
          res.json(books);
        } catch (error) {
          console.error("Error fetching books by category:", error);
          res.status(500).json({ error: "Failed to fetch books by category" });
        }
      });

      // Fetch Latest 4 Books
app.get("/latest-books", async (req, res) => {
  try {
    const latestBooks = await booksCollection
      .find({})
      .sort({ _id: -1 }) 
      .limit(4)
      .toArray();
    res.json(latestBooks);
  } catch (error) {
    console.error("Error fetching latest books:", error);
    res.status(500).json({ error: "Failed to fetch latest books" });
  }
});
      
    
app.get("/book-details/:id", verifyToken, async (req, res) => {
  try {
    const bookId = req.params.id;

    if (!ObjectId.isValid(bookId)) {
      return res.status(400).json({ error: "Invalid book ID" });
    }

    const book = await booksCollection.findOne({ _id: new ObjectId(bookId) });

    if (!book) {
      return res.status(404).json({ error: "Book not found" });
    }
    res.json(book);
  } catch (error) {
    console.error("Error fetching book details:", error);
    res.status(500).json({ error: "Failed to fetch book details" });
  }
});
 
app.post("/borrow-book", verifyToken, async (req, res) => {
  const { bookId, userName, userEmail, returnDate } = req.body;

  if (!bookId || !userName || !userEmail || !returnDate) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const book = await booksCollection.findOne({ _id: new ObjectId(bookId) });

    if (!book) {
      return res.status(404).json({ error: "Book not found" });
    }
    const existingBorrow = await borrowBooks.findOne({
      userEmail,
      bookId: new ObjectId(bookId),
    });

    if (existingBorrow) {
      return res.status(400).json({ error: "You have already borrowed this book" });
    }

    if (book.quantity <= 0) {
      return res.status(400).json({ error: "No available copies to borrow" });
    }

    const updateResult = await booksCollection.updateOne(
      { _id: new ObjectId(bookId) },
      { $inc: { quantity: -1 } }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(500).json({ error: "Failed to update book quantity" });
    }

    const borrowResult = await borrowBooks.insertOne({
      bookId: new ObjectId(bookId),
      userName,
      userEmail,
      returnDate: new Date(returnDate),
      borrowDate: new Date(),
      bookDetails: {
        name: book.name,
        authorName: book.authorName,
        category: book.category,
        image: book.image,
      },
    });

    res.status(200).json({
      success: true,
      message: "Book borrowed successfully",
      updatedBook: { ...book, quantity: book.quantity - 1 },
    });
  } catch (error) {
    console.error("Error borrowing book:", error);
    res.status(500).json({ error: "Failed to borrow book" });
  }
});


app.get("/borrowed-books/:email", verifyToken, async (req, res) => {
  try {
    const { email } = req.params;
    const decodedEmail = req.user?.email;

    if (email !== decodedEmail) {
      return res.status(403).json({ error: "Forbidden: Email mismatch" });
    }

    const borrowedBooks = await client
      .db("booksPortal")
      .collection("borrowed")
      .find({ userEmail: email })
      .toArray();

    res.json(borrowedBooks);
  } catch (error) {
    console.error("Error fetching borrowed books:", error);
    res.status(500).json({ error: "Failed to fetch borrowed books" });
  }
});
    
app.put("/borrowed-books/return/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { userEmail } = req.body;

  try {
    
    const borrowedBook = await client
      .db("booksPortal")
      .collection("borrowed")
      .findOne({ _id: new ObjectId(id), userEmail });

    if (!borrowedBook) {
      return res.status(404).json({ error: "Book not found in borrowed list for this user" });
    }

    const deleteResult = await client
      .db("booksPortal")
      .collection("borrowed")
      .deleteOne({ _id: new ObjectId(id), userEmail });

    if (deleteResult.deletedCount === 0) {
      return res.status(500).json({ error: "Failed to remove book from borrowed list" });
    }

    const bookId = borrowedBook.bookId; 
    const result = await client
      .db("booksPortal")
      .collection("books")
      .updateOne(
        { _id: new ObjectId(bookId) },
        { $inc: { quantity: 1 } }
      );

    if (result.modifiedCount === 0) {
      return res.status(500).json({ error: "Failed to update book quantity" });
    }

    res.json({ success: true, message: "Book returned successfully" });
  } catch (error) {
    console.error("Error returning book:", error);
    res.status(500).json({ error: "Failed to return book" });
  }
});
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
app.get('/', (req, res) =>{
  res.send('Book server running')
})

app.listen(port, () =>{
    console.log(`Book server running at: ${port}`)
})