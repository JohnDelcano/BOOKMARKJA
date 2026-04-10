import { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import "./styles.css";

import home from "./assets/house.png";
import favorite from "./assets/food-tray.png";
import exit from "./assets/exit.png";
import love from "./assets/heart.png";
import unlove from "./assets/lover.png";
import remove from "./assets/deleted.png";

function App() {
  const [user, setUser] = useState(null);

  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [type, setType] = useState("anime");

  const [genres, setGenres] = useState([]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("latest");

  const [bookmarks, setBookmarks] = useState([]);

  const [page, setPage] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);



  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "bookmarks"), (snap) => {
      setBookmarks(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      );
    });

    return () => unsub();
  }, []);

  const googleLogin = async () => {
    const provider = new GoogleAuthProvider();

    provider.setCustomParameters({
      prompt: "select_account",
    });

    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const addBookmark = async () => {
    if (!user || !title) return;

    await addDoc(collection(db, "bookmarks"), {
      uid: user.uid,
      title,
      imageUrl,
      type,
      genres,
      favorite: false,
      createdAt: Date.now(),
    });

    setTitle("");
    setImageUrl("");
    setGenres([]);
  };

  const deleteBookmark = async (id) => {
    await deleteDoc(doc(db, "bookmarks", id));
  };

  const toggleFavorite = async (id, current) => {
    await updateDoc(doc(db, "bookmarks", id), {
      favorite: !current,
    });
  };

  const filtered = user
    ? bookmarks
        .filter((b) => {
          const matchUser = b.uid === user.uid;
          const matchSearch = b.title
            .toLowerCase()
            .includes(search.toLowerCase());
          const matchType = filter === "all" ? true : b.type === filter;
          const matchPage =
            page === "favorites" ? b.favorite : true;

          return matchUser && matchSearch && matchType && matchPage;
        })
        .sort((a, b) => {
          if (sort === "latest") return b.createdAt - a.createdAt;
          if (sort === "a-z") return a.title.localeCompare(b.title);
          if (sort === "z-a") return b.title.localeCompare(a.title);
          return 0;
        })
    : [];

  if (!user) {
    return (
      <div className="loginPage">
        <div className="overlay">
          <h1>Bookmarks</h1>
          <button onClick={googleLogin}>Continue with Google</button>
        </div>
      </div>
    );
  }

  return (
    <div className="appLayout">

      <button
        className="hamburger"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        ☰
      </button>

      <div className={`sidebar ${sidebarOpen ? "open" : ""}`}>

        <button
          className={page === "home" ? "activeNav" : ""}
          onClick={() => {
            setPage("home");
            setSidebarOpen(false);
          }}
        >
          <img src={home} alt="" />
          <h5>Home</h5>
        </button>

        <button
          className={page === "favorites" ? "activeNav" : ""}
          onClick={() => {
            setPage("favorites");
            setSidebarOpen(false);
          }}
        >
          <img src={favorite} alt="" />
          <h5>Favorite</h5>
        </button>

        <div className="sidebarBottom">
          <button onClick={logout}>
            <img src={exit} alt="" />
            <h5>Logout</h5>
          </button>
        </div>
      </div>

      {sidebarOpen && (
        <div className="backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      <div className={`mainContent page-${page}`}>

        <div className="header">
          <h2>{page === "home" ? "Bookmarks" : "Favorites"}</h2>

          <div className="profile">
            <img src={user.photoURL} className="avatar" />
            <p>{user.displayName?.split(" ")[0]}</p>
          </div>
        </div>

        {page === "home" && (
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

          

            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="anime">Anime</option>
              <option value="manga">Manga</option>
              <option value="manhwa">Manhwa</option>
              <option value="manhua">Manhua</option>
            </select>

            <button onClick={addBookmark}>Add Bookmark</button>
          </div>
        )}

        <div className="controls">
          <input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select onChange={(e) => setSort(e.target.value)}>
            <option value="latest">Latest</option>
            <option value="a-z">A-Z</option>
            <option value="z-a">Z-A</option>
          </select>
        </div>

        <div className="filters">
          {["all", "anime", "manga", "manhwa", "manhua"].map((t) => (
            <button
              key={t}
              className={filter === t ? "activeFilter" : ""}
              onClick={() => setFilter(t)}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="grid">
          {filtered.map((b) => (
            <div className="card" key={b.id}>
              <div className="imageWrapper">
                <img src={b.imageUrl} alt={b.title} />

                <div className="overlayCard">

                  <button
                    className="iconBtn favoriteBtn"
                    onClick={() => toggleFavorite(b.id, b.favorite)}
                  >
                    <img
                      src={b.favorite ? unlove : love}
                      alt="favorite"
                    />
                  </button>

                  <button
                    className="iconBtn deleteBtn"
                    onClick={() => deleteBookmark(b.id)}
                  >
                    <img src={remove} alt="delete" />
                  </button>

                </div>
            </div>

              <div className="cardContent">
                <h3>{b.title}</h3>
              </div>

              <div className="genreTags">
                {b.genres?.map((g) => (
                  <span key={g} className="tag">{g}</span>
                ))}
              </div>

            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

export default App;