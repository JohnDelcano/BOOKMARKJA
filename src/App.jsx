import { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  deleteDoc,
  doc,
} from "firebase/firestore";

import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import Profile from "./Profile.jsx";
import "./styles.css";

function App() {
  const [user, setUser] = useState(null);

  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [link, setLink] = useState("");
  const [type, setType] = useState("anime");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [bookmarks, setBookmarks] = useState([]);

  // AUTH
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  // FIREBASE DATA
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "bookmarks"), (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setBookmarks(data);
    });

    return () => unsub();
  }, []);

  // LOGIN
  const googleLogin = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  // ADD
  const addBookmark = async () => {
    if (!user) return;
    if (!title) return;

    await addDoc(collection(db, "bookmarks"), {
      uid: user.uid,
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

  // DELETE
  const deleteBookmark = async (id) => {
    await deleteDoc(doc(db, "bookmarks", id));
  };

  // FILTER + SEARCH
  const filtered = user
    ? bookmarks.filter((b) => {
        const matchUser = b.uid === user.uid;
        const matchSearch = b.title
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchType = filter === "all" ? true : b.type === filter;

        return matchUser && matchSearch && matchType;
      })
    : [];

  // LOGIN SCREEN
  if (!user) {
    return (
      <div className="loginPage">
        <div className="overlay">
          <h1 className="logo">Bookmark+</h1>
          <h2>Save Anime, Manga & Manhwa</h2>
          <button className="googleBtn" onClick={googleLogin}>
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* HEADER */}
      <div className="header">
        <h2>Bookmark+</h2>
        <Profile user={user} />
        <button onClick={logout}>Logout</button>
      </div>

      {/* FORM */}
      <div className="form">
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

        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="anime">Anime</option>
          <option value="manga">Manga</option>
          <option value="manhwa">Manhwa</option>
          <option value="manhua">Manhua</option>
        </select>

        <button onClick={addBookmark}>Add</button>
      </div>

      {/* SEARCH */}
      <input
        className="search"
        placeholder="Search bookmarks..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* FILTER */}
      <div className="filters">
        {["all", "anime", "manga", "manhwa", "manhua"].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`filterBtn ${filter === t ? "activeFilter" : ""}`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* GRID */}
      <div className="grid">
        {filtered.map((b) => (
          <div className="card" key={b.id}>
            <img src={b.imageUrl} />

            <div className="cardContent">
              <h3 className="cardTitle">{b.title}</h3>
              <p className="genreTag">{b.type}</p>

              <button
                className="delete"
                onClick={() => deleteBookmark(b.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;