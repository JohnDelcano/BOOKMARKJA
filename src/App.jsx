import { useEffect, useState } from "react";
import { db } from "./firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  deleteDoc,
  doc
} from "firebase/firestore";

function App() {
  // 🧠 STATES
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [link, setLink] = useState("");
  const [type, setType] = useState("anime");
  const [search, setSearch] = useState("");
  const [bookmarks, setBookmarks] = useState([]);

  // ⚡ REAL-TIME FETCH
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "bookmarks"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      console.log("FIREBASE DATA:", data); // 👈 ADD THIS
      setBookmarks(data);
    });

    return () => unsubscribe();
  }, []);

  // ➕ ADD BOOKMARK
  const addBookmark = async () => {
    if (!title) return;

    await addDoc(collection(db, "bookmarks"), {
      title,
      imageUrl,
      link,
      type,
      createdAt: new Date(),
    });

    setTitle("");
    setImageUrl("");
    setLink("");
  };

  // 🗑️ DELETE
  const deleteBookmark = async (id) => {
    await deleteDoc(doc(db, "bookmarks", id));
  };

  // 🔍 SEARCH FILTER
  const filtered = bookmarks.filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>📚 Anime/Manga Bookmark App</h1>

      {/* 🔍 SEARCH */}
      <input
        placeholder="Search bookmarks..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: "10px", width: "100%" }}
      />

      {/* ➕ FORM */}
      <div style={{ marginBottom: "20px" }}>
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <input
          placeholder="Image URL"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />

        <input
          placeholder="Link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />

        {/* TYPE SELECT */}
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="anime">Anime</option>
          <option value="manga">Manga</option>
          <option value="manhwa">Manhwa</option>
        </select>

        <button onClick={addBookmark}>Add</button>
      </div>

      {/* 🎴 CARDS */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "15px",
        }}
      >
        {filtered.map((item) => (
          <div
            key={item.id}
            style={{
              width: "180px",
              background: "#1e1e1e",
              color: "white",
              borderRadius: "10px",
              padding: "10px",
            }}
          >
            <img
              src={item.imageUrl}
              style={{
                width: "100%",
                height: "220px",
                objectFit: "cover",
                borderRadius: "8px",
              }}
            />

            <h3 style={{ fontSize: "14px" }}>{item.title}</h3>

            <p style={{ fontSize: "12px", color: "gray" }}>
              {item.type}
            </p>

            <a href={item.link} target="_blank">
              Open
            </a>

            <br />

            <button
              onClick={() => deleteBookmark(item.id)}
              style={{
                marginTop: "5px",
                background: "red",
                color: "white",
                border: "none",
                padding: "5px",
                borderRadius: "5px",
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;