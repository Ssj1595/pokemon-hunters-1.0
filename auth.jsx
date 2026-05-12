/* global React */

const {
  useState: _useState,
  useEffect: _useEffect,
  useCallback: _useCallback
} = React;

const SESSION_KEY = "ph_admin_session_v1";

const ALLOWED_EMAILS = Object.freeze([
  "ssjshantan@gmail.com",
  "nandiniananthabotla@gmail.com",
]);

window.ALLOWED_EMAILS = ALLOWED_EMAILS;

async function getAdminCreds() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_auth?select=*`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await res.json();

    if (!data || !data.length) {
      return null;
    }

    return data[0];
  } catch (err) {
    console.error(err);
    return null;
  }
}

window.useAdminAuth = function() {
  const [isAdmin, setIsAdmin] = _useState(false);
  const [ready, setReady] = _useState(false);

  _useEffect(() => {
    (async () => {
      try {
        const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");

        if (
          s &&
          s.loggedIn &&
          (!s.expires || s.expires > Date.now())
        ) {
          setIsAdmin(true);
        }
      } catch {}

      setReady(true);
    })();
  }, []);

  const login = _useCallback(async (userId, password) => {
    try {
      
      const cleanUserId = userId.trim().toUpperCase();

      const { data, error } = await supabaseClient
        .from("admin_auth")
        .select("*")
        .eq("user_id", cleanUserId)
        .single();

      if (error || !data) {
        return {
          ok: false,
          error: "Invalid credentials"
        };
      }

      const hash = await sha256(password);
      

      console.log("INPUT USER:", cleanUserId);
console.log("DB USER:", data.user_id);

console.log("INPUT HASH:", hash);
console.log("DB HASH:", data.pass_hash);

      if (hash !== data.pass_hash) {
        return {
          ok: false,
          error: "Invalid credentials"
        };
      }

      const session = {
          loggedIn: true,
          userId: cleanUserId,
          expires: Date.now() + 1000 * 60 * 60 * 24 * 7
      };

      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify(session)
      );

      setIsAdmin(true);

      return { ok: true };

    } catch (err) {
      console.error(err);

      return {
        ok: false,
        error: "Unable to load admin credentials"
      };
    }
  }, []);

  const logout = _useCallback(() => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {}

    setIsAdmin(false);
  }, []);

  const changePassword = _useCallback(async (current, next) => {

  try {

    const session = JSON.parse(
      localStorage.getItem(SESSION_KEY) || "null"
    );

    if (!session?.userId) {
      return {
        ok: false,
        error: "Session expired"
      };
    }

    const currentUserId = session.userId;

    const { data, error } = await supabaseClient
      .from("admin_auth")
      .select("*")
      .eq("user_id", currentUserId)
      .single();

    if (error || !data) {
      return {
        ok: false,
        error: "Admin account not found"
      };
    }

    const curHash = await sha256(current);

    if (curHash !== data.pass_hash) {
      return {
        ok: false,
        error: "Current password is incorrect"
      };
    }

    if (!next || next.length < 4) {
      return {
        ok: false,
        error: "New password must be at least 4 characters"
      };
    }

    const newHash = await sha256(next);

    const { error: updateError } = await supabaseClient
      .from("admin_auth")
      .update({
        pass_hash: newHash
      })
      .eq("user_id", currentUserId);

    if (updateError) {
      return {
        ok: false,
        error: "Failed to update password"
      };
    }

    return { ok: true };

  } catch (err) {
    console.error(err);

    return {
      ok: false,
      error: "Password update failed"
    };
  }

   }, []);

  const requestReset = _useCallback(async (email) => {

    const e = (email || "").trim().toLowerCase();

    if (!ALLOWED_EMAILS.includes(e)) {
      return {
        ok: false,
        error: "This email is not authorised for password resets."
      };
    }

    const code = String(
      Math.floor(100000 + Math.random() * 900000)
    );

    const codeHash = await sha256(code);

    const ticket = {
      email: e,
      codeHash,
      expires: Date.now() + 1000 * 60 * 15
    };

    try {
      localStorage.setItem(
        RESET_KEY,
        JSON.stringify(ticket)
      );
    } catch {}

    return {
      ok: true,
      email: e,
      code
    };

  }, []);

  const completeReset = _useCallback(async (
    email,
    code,
    newPass
  ) => {

    let t = null;

    try {
      t = JSON.parse(
        localStorage.getItem(RESET_KEY) || "null"
      );
    } catch {}

    if (!t) {
      return {
        ok: false,
        error: "No reset request found. Start again."
      };
    }

    if (t.expires < Date.now()) {
      return {
        ok: false,
        error: "Reset code expired. Start again."
      };
    }

    if (
      t.email !==
      (email || "").trim().toLowerCase()
    ) {
      return {
        ok: false,
        error: "Email does not match request."
      };
    }

    const codeHash = await sha256(code);

    if (codeHash !== t.codeHash) {
      return {
        ok: false,
        error: "Incorrect reset code."
      };
    }

    if (!newPass || newPass.length < 4) {
      return {
        ok: false,
        error: "New password must be at least 4 characters."
      };
    }

    const newHash = await sha256(newPass);

    const { error } = await supabaseClient
      .from("admin_auth")
      .update({
        pass_hash: newHash
      })
      .eq("user_id", DEFAULT_USERID);

    if (error) {
      return {
        ok: false,
        error: "Failed to reset password"
      };
    }

    try {
      localStorage.removeItem(RESET_KEY);
    } catch {}

    return { ok: true };

  }, []);

  return {
    isAdmin,
    ready,
    login,
    logout,
    changePassword,
    requestReset,
    completeReset
  };
};

// ---------- UI ----------

window.AdminBadge = function AdminBadge({
  auth,
  onOpenLogin,
  onOpenManage,
}) {
  if (!auth.ready) return null;

  if (!auth.isAdmin) {
    return (
      <button
        className="admin-badge"
        onClick={onOpenLogin}
        title="Admin login"
      >
        🔐 ADMIN
      </button>
    );
  }

  return (
    <div
      className="admin-badge on"
      onClick={onOpenManage}
    >
      <span className="dot"></span> ADMIN
    </div>
  );
};

window.LoginModal = function LoginModal({
  open,
  onClose,
  auth,
}) {
  const [userId, setUserId] = _useState("");
  const [pass, setPass] = _useState("");
  const [err, setErr] = _useState("");
  const [busy, setBusy] = _useState(false);

  _useEffect(() => {
    if (!open) {
      setUserId("");
      setPass("");
      setErr("");
    }
  }, [open]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();

    setBusy(true);
    setErr("");

    const r = await auth.login(
      userId.trim(),
      pass
    );

    setBusy(false);

    if (!r.ok) setErr(r.error);
    else onClose();
  };

  return (
    <div className="ab-back" onClick={onClose}>
      <form
        className="ab-modal auth-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="ab-hdr">
          <h2>🔐 ADMIN LOGIN</h2>

          <button
            type="button"
            className="ab-x"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="ab-body">
          <div className="auth-note">
            Restricted Admin Access
          </div>

          <label className="ab-row">
            <span>User ID</span>

            <input
              value={userId}
              onChange={(e) =>
                setUserId(e.target.value)
              }
              autoFocus
              required
            />
          </label>

          <label className="ab-row">
            <span>Password</span>

            <input
              type="password"
              value={pass}
              onChange={(e) =>
                setPass(e.target.value)
              }
              required
            />
          </label>

          {err && (
            <div className="auth-err">
              ⚠ {err}
            </div>
          )}
        </div>

        <div className="ab-foot">
          <button
            type="button"
            className="ab-btn ghost"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="ab-btn primary"
            disabled={busy}
          >
            {busy ? "Checking…" : "✦ Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
};

window.ManageModal = function ManageModal({
  open,
  onClose,
  auth,
}) {
  const [cur, setCur] = _useState("");
  const [next1, setNext1] = _useState("");
  const [next2, setNext2] = _useState("");
  const [msg, setMsg] = _useState("");
  const [err, setErr] = _useState("");

  _useEffect(() => {
    if (!open) {
      setCur("");
      setNext1("");
      setNext2("");
      setMsg("");
      setErr("");
    }
  }, [open]);

  if (!open) return null;

  const submitChange = async (e) => {
    e.preventDefault();

    setErr("");
    setMsg("");

    if (next1 !== next2) {
      setErr("New passwords don't match");
      return;
    }

    const r = await auth.changePassword(
      cur,
      next1
    );

    if (!r.ok) {
      setErr(r.error);
    } else {
      setMsg("✓ Password updated.");
      setCur("");
      setNext1("");
      setNext2("");
    }
  };

  return (
    <div className="ab-back" onClick={onClose}>
      <div
        className="ab-modal auth-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ab-hdr">
          <h2>⚙ ADMIN PANEL</h2>

          <button
            type="button"
            className="ab-x"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <form
          className="ab-body"
          onSubmit={submitChange}
        >
          <label className="ab-row">
            <span>Current password</span>

            <input
              type="password"
              value={cur}
              onChange={(e) =>
                setCur(e.target.value)
              }
              required
            />
          </label>

          <label className="ab-row">
            <span>New password</span>

            <input
              type="password"
              value={next1}
              onChange={(e) =>
                setNext1(e.target.value)
              }
              required
              minLength={4}
            />
          </label>

          <label className="ab-row">
            <span>Confirm new password</span>

            <input
              type="password"
              value={next2}
              onChange={(e) =>
                setNext2(e.target.value)
              }
              required
              minLength={4}
            />
          </label>

          {err && (
            <div className="auth-err">
              ⚠ {err}
            </div>
          )}

          {msg && (
            <div className="auth-ok">
              {msg}
            </div>
          )}

          <div className="ab-foot inline">
            <button
              type="button"
              className="ab-btn ghost"
              onClick={() =>
                auth.logout() || onClose()
              }
            >
              Sign out
            </button>

            <button
              type="submit"
              className="ab-btn primary"
            >
              Update password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};