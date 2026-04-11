import { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import "./styles.css";

import homeIcon from "./assets/house.png";
import bookmarkNavIcon from "./assets/food-tray.png";
import exitIcon from "./assets/exit.png";

function App() {
  /* =========================
     STATES
  ========================= */
  const [user, setUser] = useState("loading");
  const [page, setPage] = useState("home");

  const [feed, setFeed] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState([]);
  const [categories, setCategories] = useState([]);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [filter, setFilter] = useState("all");
  const [activeCard, setActiveCard] = useState(null);

  // Bookmark modal (from card)
  const [bookmarkModalItem, setBookmarkModalItem] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);

  // Bookmark page states
  const [bookmarkSearch, setBookmarkSearch] = useState("");
  const [bookmarkFilter, setBookmarkFilter] = useState("all");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [shuffledFeed, setShuffledFeed] = useState([]);
  /* =========================
     AUTH
  ========================= */
  useEffect(() => {
    const authTimeout = setTimeout(() => {
      console.warn("Auth timeout - showing login");
      setUser(null);
    }, 7000);

    const unsub = onAuthStateChanged(auth, (currentUser) => {
      clearTimeout(authTimeout);
      setUser(currentUser);
    });

    return () => {
      clearTimeout(authTimeout);
      unsub();
    };
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  /* =========================
     FIRESTORE — BOOKMARKS
  ========================= */
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "bookmarks"),
      (snap) => {
        setBookmarks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => {
        console.error("Bookmarks listener error:", error);
        setBookmarks([]);
      }
    );
    return () => unsub();
  }, []);

  /* =========================
     FIRESTORE — CATEGORIES
  ========================= */
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "categories"),
      (snap) => {
        setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => {
        console.error("Categories listener error:", error);
        setCategories([]);
      }
    );
    return () => unsub();
  }, []);

  const shuffleArray = (array) => {
  return [...array].sort(() => Math.random() - 0.5);
};

  /* =========================
     FEED (TOP RATED ONLY)
  ========================= */
  useEffect(() => {
    const load = async () => {
      try {
        const results = await Promise.race([
          Promise.allSettled([
            fetchTopAnime(),
            fetchTopManga(),
            fetchTopManhwa(),
            fetchTopManhua(),
            fetchMangaDex(),
          ]),
          new Promise((resolve) => setTimeout(() => resolve("TIMEOUT"), 10000)),
        ]);

        if (results === "TIMEOUT") {
          console.warn("Feed loading timed out");
          setFeed([]);
          setShuffledFeed([]);
          setFeedLoading(false);
          return;
        }

        // Extract only successful results
        const data = results
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value)
          .flat();

        console.log("Feed loaded:", data.length, "items");

        const unique = Array.from(
          new Map(data.map((i) => [`${i.source}-${i.id}`, i])).values()
        );

        setFeed(unique);
        setShuffledFeed(shuffleArray(unique));
      } catch (error) {
        console.error("Error loading feed:", error);
        setFeed([]);
        setShuffledFeed([]);
      } finally {
        setFeedLoading(false);
      }
    };

    load();
  }, []);

  /* =========================
     GLOBAL SEARCH (AniList ONLY)
  ========================= */
  useEffect(() => {
    const delay = setTimeout(async () => {
      const text = search.trim();

      if (text.length > 2) {
        setIsSearching(true);
        const results = await searchAniList(text);
        setSearchResults(results);
      } else {
        setIsSearching(false);
        setSearchResults([]);
      }
    }, 400);

    return () => clearTimeout(delay);
  }, [search]);

  /* =========================
     HELPERS
  ========================= */
  const getTitle = (t) => t?.english || t?.romaji || "No Title";
  const cleanHTML = (t) => t?.replace(/<[^>]+>/g, "");

  const detectType = (item) => {
  // 🔥 FIRST: use your custom mediaType
  if (item.mediaType) return item.mediaType;

  // fallback (for search results)
  if (item.type === "ANIME") return "anime";
  if (item.source === "mangadex") return "manga";
  if (item.countryOfOrigin === "KR") return "manhwa";
  if (item.countryOfOrigin === "CN") return "manhua";

  return "manga";
};

  const isBookmarked = (item) =>
    bookmarks.some((b) => b.mediaId === item.id);

  /* =========================
     BOOKMARK MODAL OPEN
  ========================= */
  const openBookmarkModal = (e, item) => {
    e.stopPropagation();
    setBookmarkModalItem(item);
    // pre-select existing categories for this item
    const existing = bookmarks.find((b) => b.mediaId === item.id);
    setSelectedCategories(existing?.categories || []);
  };

  const closeBookmarkModal = () => {
    setBookmarkModalItem(null);
    setSelectedCategories([]);
  };

  const toggleCategorySelection = (catId) => {
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  };

  /* =========================
     CONFIRM BOOKMARK (OK)
  ========================= */
  const confirmBookmark = async () => {
    if (!bookmarkModalItem) return;
    const item = bookmarkModalItem;
    const existing = bookmarks.find((b) => b.mediaId === item.id);

    if (existing) {
      await updateDoc(doc(db, "bookmarks", existing.id), {
        categories: selectedCategories,
      });
    } else {
      await addDoc(collection(db, "bookmarks"), {
        uid: user.uid,
        mediaId: item.id,
        title: getTitle(item.title),
        imageUrl: item.coverImage?.large,
        description: cleanHTML(item.description),
        categories: selectedCategories,
        createdAt: serverTimestamp(),
      });
    }

    closeBookmarkModal();
  };

  /* =========================
     REMOVE BOOKMARK
  ========================= */
  const removeBookmark = async (id) => {
    await deleteDoc(doc(db, "bookmarks", id));
  };

  /* =========================
     ADD CATEGORY
  ========================= */
  const addCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    await addDoc(collection(db, "categories"), {
      uid: user.uid,
      name,
      createdAt: serverTimestamp(),
    });
    setNewCategoryName("");
    setShowAddCategory(false);
  };

  /* =========================
     DELETE CATEGORY
  ========================= */
  const deleteCategory = async (id) => {
    await deleteDoc(doc(db, "categories", id));
  };

  /* =========================
     AUTH UI SAFE
  ========================= */
  if (user === "loading") {
    return (
      <div className="loginPage">
        <h1>Hybrid Feed</h1>
        <p>Initializing... ⏳</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="loginPage">
        <h1>Hybrid Feed</h1>
        <button onClick={login}>Login</button>
      </div>
    );
  }

  /* =========================
     DISPLAY LOGIC
  ========================= */
  const displayFeed = isSearching ? searchResults : feed;

  const filteredBookmarks = bookmarks.filter((b) => {
    const matchSearch = b.title
      ?.toLowerCase()
      .includes(bookmarkSearch.toLowerCase());
    const matchFilter =
      bookmarkFilter === "all" || b.categories?.includes(bookmarkFilter);
    return matchSearch && matchFilter;
  });

  /* =========================
     UI
  ========================= */
  return (
    <div className="layout">

      {/* ── SIDEBAR ── */}
      <div className="sidebar">
        <button
          className={page === "home" ? "active" : ""}
          onClick={() => setPage("home")}
        >
          <img src={homeIcon} alt="Home" />
        </button>

        <button
          className={page === "bookmarks" ? "active" : ""}
          onClick={() => setPage("bookmarks")}
        >
          <img src={bookmarkNavIcon} alt="Bookmarks" />
        </button>

        <div className="bottom">
          <button onClick={logout}>
            <img src={exitIcon} alt="Logout" />
          </button>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div className={`main${bookmarkModalItem ? " blurred" : ""}`}>

        {/* ══ HOME PAGE ══ */}
        {page === "home" && (
          <>
          <input
            className="searchBar"
            placeholder="Search anime, manga, manhwa, manhua..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {isSearching && (
            <p style={{ color: "#aaa", marginTop: "10px" }}>
              Searching results...
            </p>
          )}

          <div className="filterBar">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button>
            <button className={filter === "anime" ? "active" : ""} onClick={() => setFilter("anime")}>Anime</button>
            <button className={filter === "manga" ? "active" : ""} onClick={() => setFilter("manga")}>Manga</button>
            <button className={filter === "manhwa" ? "active" : ""} onClick={() => setFilter("manhwa")}>Manhwa</button>
            <button className={filter === "manhua" ? "active" : ""} onClick={() => setFilter("manhua")}>Manhua</button>
          </div>

          {feedLoading && (
            <p style={{ color: "#aaa", marginTop: "20px", textAlign: "center", fontSize: "16px" }}>
              Loading anime, manga, manhwa, manhua... ⏳
            </p>
          )}

          <div className="grid">
            {(filter === "all"
              ? shuffledFeed
              : displayFeed
            )
            .filter((item) => {
              const text = search.toLowerCase();

              const title = getTitle(item.title).toLowerCase();
              const desc = item.description?.toLowerCase() || "";
              const genres = item.genres?.join(" ").toLowerCase() || "";

              const matchesSearch =
                title.includes(text) ||
                desc.includes(text) ||
                genres.includes(text);

              const type = detectType(item);

              return matchesSearch && (filter === "all" || type === filter);
            })
            .map((item) => (
            
                <div
                  key={`${item.source}-${item.id}`}
                  className={`card${activeCard === item.id ? " flipped" : ""}`}
                  onClick={() =>
                    setActiveCard(activeCard === item.id ? null : item.id)
                  }
                >
                  <div className="cardFront">
                    <div className="cardCover">
                      <img src={item.coverImage?.large} alt={getTitle(item.title)} />
                      <span className="typeBadge">{detectType(item)}</span>
                      {isBookmarked(item) && <span className="bookmarkedDot" />}
                    </div>
                    <div className="cardInfo">
                      <h3 className="cardTitle">{getTitle(item.title)}</h3>
                      {item.genres?.length > 0 && (
                        <div className="genreRow">
                          {item.genres.slice(0, 3).map((g) => (
                            <span key={g} className="genrePill">{g}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="cardBack">
                    <div className="glass">
                      <p className="backTitle">{getTitle(item.title)}</p>
                      <p className="desc">{cleanHTML(item.description)}</p>
                      <div className="actions">
                        <button
                          className={`bookmarkBtn${isBookmarked(item) ? " bookmarked" : ""}`}
                          onClick={(e) => openBookmarkModal(e, item)}
                        >
                          {isBookmarked(item) ? "✏️ Edit" : "🔖 Add Bookmark"}
                        </button>
                        {isBookmarked(item) && (
                          <button
                            className="cancelBookmarkBtn"
                            onClick={(e) => {
                              e.stopPropagation();
                              const existing = bookmarks.find((b) => b.mediaId === item.id);
                              if (existing) removeBookmark(existing.id);
                            }}
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
          </>
        )}

        {/* ══ BOOKMARKS PAGE ══ */}
        {page === "bookmarks" && (
          <div className="bookmarksPage">

            {/* Header */}
            <div className="bookmarksHeader">
              <h2 className="bookmarksTitle">🔖 Bookmarks</h2>
              <button
                className="addCategoryBtn"
                onClick={() => setShowAddCategory((v) => !v)}
              >
                + New Category
              </button>
            </div>

            {/* Add Category Form */}
            {showAddCategory && (
              <div className="addCategoryForm">
                <input
                  type="text"
                  placeholder="Category name (e.g. Manhwa, Romance...)"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCategory()}
                />
                <button onClick={addCategory}>Add</button>
                <button
                  className="cancelBtn"
                  onClick={() => setShowAddCategory(false)}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Category pills */}
            {categories.length > 0 && (
              <div className="categoryPills">
                {categories.map((cat) => (
                  <div key={cat.id} className="categoryPill">
                    <span>{cat.name}</span>
                    <button
                      className="deleteCatBtn"
                      onClick={() => deleteCategory(cat.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Bookmark search + filter */}
            <div className="bookmarkControls">
              <input
                className="searchBar"
                placeholder="Search bookmarks..."
                value={bookmarkSearch}
                onChange={(e) => setBookmarkSearch(e.target.value)}
                style={{ marginBottom: 0, flex: 1 }}
              />
              <select
                className="categorySelect"
                value={bookmarkFilter}
                onChange={(e) => setBookmarkFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Bookmark grid */}
            {filteredBookmarks.length === 0 ? (
              <p className="emptyState">
                No bookmarks yet. Go to Home and add some! 📚
              </p>
            ) : (
              <div className="grid" style={{ marginTop: "16px" }}>
                {filteredBookmarks.map((b) => (
                  <div
                    key={b.id}
                    className={`card${activeCard === b.id ? " flipped" : ""}`}
                    onClick={() =>
                      setActiveCard(activeCard === b.id ? null : b.id)
                    }
                  >
                    {/* FRONT */}
                    <div className="cardFront">
                      <div className="cardCover">
                        <img src={b.imageUrl} alt={b.title} />
                        <span className="typeBadge">saved</span>
                        <span className="bookmarkedDot" />
                      </div>
                      <div className="cardInfo">
                        <h3 className="cardTitle">{b.title}</h3>
                        {b.categories?.length > 0 && (
                          <div className="genreRow">
                            {b.categories.slice(0, 3).map((catId) => {
                              const cat = categories.find((c) => c.id === catId);
                              return cat ? (
                                <span key={catId} className="genrePill">{cat.name}</span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* BACK */}
                    <div className="cardBack">
                      <div className="glass">
                        <p className="backTitle">{b.title}</p>
                        {b.categories?.length > 0 && (
                          <div className="backBadges">
                            {b.categories.map((catId) => {
                              const cat = categories.find((c) => c.id === catId);
                              return cat ? (
                                <span key={catId} className="badge">{cat.name}</span>
                              ) : null;
                            })}
                          </div>
                        )}
                        <p className="desc">{b.description}</p>
                        <div className="actions">
                          <button
                            className="editBtn"
                            onClick={(e) => {
                              e.stopPropagation();
                              // open modal in edit mode using a reconstructed item-like object
                              const fakeItem = {
                                id: b.mediaId,
                                title: { english: b.title },
                                coverImage: { large: b.imageUrl },
                                description: b.description,
                              };
                              openBookmarkModal(e, fakeItem);
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="cancelBookmarkBtn"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeBookmark(b.id);
                            }}
                          >
                            🗑 Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ══ MOBILE NAV ══ */}
      <div className="mobileNav">
        <button className={page === "home" ? "active" : ""} onClick={() => setPage("home")}>
          <img src={homeIcon} alt="Home" />
          <span>Home</span>
        </button>
        <button className={page === "bookmarks" ? "active" : ""} onClick={() => setPage("bookmarks")}>
          <img src={bookmarkNavIcon} alt="Bookmarks" />
          <span>Bookmarks</span>
        </button>
        <button onClick={logout}>
          <img src={exitIcon} alt="Logout" />
          <span>Logout</span>
        </button>
      </div>

      {/* ══ BOOKMARK MODAL ══ */}
      {bookmarkModalItem && (
        <div className="modalOverlay" onClick={closeBookmarkModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modalTitle">Set Categories</h3>

            {categories.length === 0 ? (
              <p className="modalEmpty">
                No categories yet. Go to the Bookmarks tab to create some.
              </p>
            ) : (
              <div className="modalCategories">
                {categories.map((cat) => (
                  <label key={cat.id} className="categoryCheckbox">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat.id)}
                      onChange={() => toggleCategorySelection(cat.id)}
                    />
                    <span>{cat.name}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="modalActions">
              <button className="okBtn" onClick={confirmBookmark}>
                Ok
              </button>
              <button className="cancelModalBtn" onClick={closeBookmarkModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* =========================
   API FUNCTIONS
========================= */

// Helper function to add timeout to fetch
const fetchWithTimeout = async (url, options = {}, timeout = 8000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

const fetchTopAnime = async () => {
  const query = `
    query {
      Page(page: 1, perPage: 20) {
        media(
          type: ANIME
          sort: SCORE_DESC
          isAdult: false
          genre_not_in: ["Ecchi", "Hentai"]
        ) {
          id type
          title { romaji english }
          description
          genres
          countryOfOrigin
          coverImage { large }
        }
      }
    }
  `;
  try {
    const res = await fetchWithTimeout("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.data?.Page?.media || []).map((i) => ({ ...i, source: "anilist", mediaType: "anime" }));
  } catch (error) {
    console.error("fetchTopAnime failed:", error);
    return [];
  }
};

const fetchTopManga = async () => {
  const query = `
    query {
      Page(page: 1, perPage: 20) {
        media(type: MANGA, sort: SCORE_DESC, isAdult: false, genre_not_in: ["Ecchi", "Hentai"]) {
          id title { romaji english }
          description genres countryOfOrigin
          coverImage { large }
        }
      }
    }
  `;
  try {
    const res = await fetchWithTimeout("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.data?.Page?.media || []).map((i) => ({ ...i, source: "anilist", mediaType: "manga" }));
  } catch (error) {
    console.error("fetchTopManga failed:", error);
    return [];
  }
};

const fetchTopManhwa = async () => {
  const query = `
    query {
      Page(page: 1, perPage: 20) {
        media(type: MANGA, countryOfOrigin: KR, sort: SCORE_DESC, isAdult: false, genre_not_in: ["Ecchi", "Hentai"]) {
          id title { romaji english }
          description genres countryOfOrigin
          coverImage { large }
        }
      }
    }
  `;
  try {
    const res = await fetchWithTimeout("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.data?.Page?.media || []).map((i) => ({ ...i, source: "anilist", mediaType: "manhwa" }));
  } catch (error) {
    console.error("fetchTopManhwa failed:", error);
    return [];
  }
};

const fetchTopManhua = async () => {
  const query = `
    query {
      Page(page: 1, perPage: 20) {
        media(type: MANGA, countryOfOrigin: CN, sort: SCORE_DESC, isAdult: false, genre_not_in: ["Ecchi", "Hentai"]) {
          id title { romaji english }
          description genres countryOfOrigin
          coverImage { large }
        }
      }
    }
  `;
  try {
    const res = await fetchWithTimeout("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.data?.Page?.media || []).map((i) => ({ ...i, source: "anilist", mediaType: "manhua" }));
  } catch (error) {
    console.error("fetchTopManhua failed:", error);
    return [];
  }
};

const fetchMangaDex = async () => {
  try {
    const res = await fetchWithTimeout(
      "https://api.mangadex.org/manga?limit=20&includes[]=cover_art",
      {},
      8000
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.data || []).map((m) => {
      const cover = m.relationships?.find((r) => r.type === "cover_art");
      const file = cover?.attributes?.fileName;
      return {
        id: m.id,
        title: {
          english: m.attributes.title.en || Object.values(m.attributes.title)[0],
        },
        description: m.attributes.description.en || "",
        genres: [],
        coverImage: {
          large: file
            ? `https://uploads.mangadex.org/covers/${m.id}/${file}`
            : "https://via.placeholder.com/300x400",
        },
        source: "mangadex",
      };
    });
  } catch (error) {
    console.error("fetchMangaDex failed:", error);
    return [];
  }
};

const searchAniList = async (text) => {
  const query = `
    query ($search: String) {
      Page(page: 1, perPage: 20) {
        media(search: $search, isAdult: false, genre_not_in: ["Ecchi", "Hentai"]) {
          id type title { romaji english }
          description genres countryOfOrigin
          coverImage { large }
        }
      }
    }
  `;
  try {
    const res = await fetchWithTimeout("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { search: text } }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.data?.Page?.media || []).map((i) => ({ ...i, source: "anilist" }));
  } catch (error) {
    console.error("searchAniList failed:", error);
    return [];
  }
};

export default App;