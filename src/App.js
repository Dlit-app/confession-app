import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// YOUR SUPABASE KEYS
const supabaseUrl = 'https://sycsrjjtaypcofclhytk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Y3Nyamp0YXlwY29mY2xoeXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNDc2OTQsImV4cCI6MjA5MTcyMzY5NH0.Sr2gq1EKI3pwPBiwdz3Btdc1GMTqkjBcqY3SFw4F2i8';
const supabase = createClient(supabaseUrl, supabaseKey);

// Generate a unique user ID for this browser (stored in localStorage)
function getUserId() {
  let userId = localStorage.getItem('anonymous_user_id');
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('anonymous_user_id', userId);
  }
  return userId;
}

function App() {
  const [confessions, setConfessions] = useState([]);
  const [newConfession, setNewConfession] = useState('');
  const [anonymousName, setAnonymousName] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUniversity, setSelectedUniversity] = useState('UT Austin');
  const [isPremium, setIsPremium] = useState(false);
  const [userVotes, setUserVotes] = useState({});
  
  // Admin panel states
  const [showAdmin, setShowAdmin] = useState(false);
  const [allReports, setAllReports] = useState([]);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  const userId = getUserId();

  const universities = [
    { id: 1, name: 'UT Austin' },
    { id: 2, name: 'NYU' },
    { id: 3, name: 'UCLA' },
    { id: 4, name: 'University of Michigan' },
    { id: 5, name: 'Harvard University' },
    { id: 6, name: 'Stanford University' },
    { id: 7, name: 'University of Florida' },
    { id: 8, name: 'Ohio State University' },
    { id: 9, name: 'University of Washington' },
    { id: 10, name: 'Penn State University' }
  ];

  useEffect(() => {
    loadConfessions();
    const names = ['Quiet Panda', 'Loud Llama', 'Sleepy Sloth', 'Angry Cat', 'Happy Fox', 'Mysterious Owl', 'Silent Wolf'];
    setAnonymousName(names[Math.floor(Math.random() * names.length)]);
  }, []);

  useEffect(() => {
    if (selectedUniversity) {
      loadConfessions();
    }
  }, [selectedUniversity]);

  async function loadConfessions() {
    if (!selectedUniversity) return;
    setLoading(true);
    
    // Get confessions
    const { data: confessionData, error: confessionError } = await supabase
      .from('confessions')
      .select('*')
      .eq('university', selectedUniversity)
      .eq('is_flagged', false)
      .order('created_at', { ascending: false });
    
    if (confessionError) {
      console.error('Load error:', confessionError);
    }
    
    setConfessions(confessionData || []);
    
    // Get user's votes
    if (confessionData && confessionData.length > 0) {
      const confessionIds = confessionData.map(c => c.id);
      const { data: voteData } = await supabase
        .from('votes')
        .select('confession_id, vote_type')
        .eq('user_id', userId)
        .in('confession_id', confessionIds);
      
      const voteMap = {};
      if (voteData) {
        voteData.forEach(vote => {
          voteMap[vote.confession_id] = vote.vote_type;
        });
      }
      setUserVotes(voteMap);
    }
    
    setLoading(false);
  }

  async function postConfession() {
    if (!newConfession.trim()) {
      alert('Please write something');
      return;
    }

    const badWords = ['fuck', 'shit', 'asshole', 'bitch', 'cunt', 'nigger', 'faggot'];
    const lowerContent = newConfession.toLowerCase();
    for (let word of badWords) {
      if (lowerContent.includes(word)) {
        alert('Please remove inappropriate language.');
        return;
      }
    }

    const { data, error } = await supabase
      .from('confessions')
      .insert([{ 
        content: newConfession, 
        university: selectedUniversity
      }])
      .select();
    
    if (error) {
      alert('Error: ' + error.message);
    } else if (data) {
      setConfessions([data[0], ...confessions]);
      setNewConfession('');
    }
  }

  async function vote(confessionId, voteType) {
    const currentVote = userVotes[confessionId];
    
    // If already voted the same way, remove vote
    if (currentVote === voteType) {
      // Delete the vote
      await supabase
        .from('votes')
        .delete()
        .eq('confession_id', confessionId)
        .eq('user_id', userId);
      
      // Update the confession vote counts
      const confession = confessions.find(c => c.id === confessionId);
      if (confession) {
        const update = voteType === 'up' 
          ? { upvotes: (confession.upvotes || 0) - 1 }
          : { downvotes: (confession.downvotes || 0) - 1 };
        
        await supabase
          .from('confessions')
          .update(update)
          .eq('id', confessionId);
      }
      
      // Update local state
      const newVotes = { ...userVotes };
      delete newVotes[confessionId];
      setUserVotes(newVotes);
    }
    // If voting differently than before
    else {
      // If had a previous vote, remove it first
      if (currentVote) {
        await supabase
          .from('votes')
          .delete()
          .eq('confession_id', confessionId)
          .eq('user_id', userId);
      }
      
      // Add new vote
      await supabase
        .from('votes')
        .insert([{ confession_id: confessionId, user_id: userId, vote_type: voteType }]);
      
      // Update confession counts
      const confession = confessions.find(c => c.id === confessionId);
      if (confession) {
        let update = {};
        if (currentVote === 'up' && voteType === 'down') {
          update = { upvotes: (confession.upvotes || 0) - 1, downvotes: (confession.downvotes || 0) + 1 };
        } else if (currentVote === 'down' && voteType === 'up') {
          update = { upvotes: (confession.upvotes || 0) + 1, downvotes: (confession.downvotes || 0) - 1 };
        } else if (voteType === 'up') {
          update = { upvotes: (confession.upvotes || 0) + 1 };
        } else {
          update = { downvotes: (confession.downvotes || 0) + 1 };
        }
        
        await supabase
          .from('confessions')
          .update(update)
          .eq('id', confessionId);
      }
      
      // Update local state
      setUserVotes({ ...userVotes, [confessionId]: voteType });
    }
    
    // Reload confessions to show updated counts
    loadConfessions();
  }

  async function reportConfession(id) {
    const reason = prompt('Why are you reporting this confession?\n\n(Example: "Bullying", "Hate speech", "Spam", etc.)');
    if (reason && reason.trim()) {
      const { error } = await supabase.from('reports').insert([{ 
        confession_id: id, 
        reason: reason 
      }]);
      
      if (error) {
        alert('Error reporting: ' + error.message);
      } else {
        alert('Thank you for reporting. Our team will review it.');
      }
    }
  }

  // Admin Functions
  async function adminLogin() {
    // YOUR PASSWORD IS: myCoolPassword2024
    const correctPassword = 'myCoolPassword2024';
    
    if (adminPassword === correctPassword) {
      setIsAdminAuthenticated(true);
      await loadReports();
    } else {
      alert('Wrong password. Access denied.');
    }
  }

  async function loadReports() {
    const { data } = await supabase
      .from('reports')
      .select('*, confessions(content)')
      .order('created_at', { ascending: false });
    
    setAllReports(data || []);
    setShowAdmin(true);
  }

  async function deleteConfession(confessionId, reportId) {
    if (window.confirm('Delete this confession? This cannot be undone.')) {
      // Delete the confession
      await supabase.from('confessions').delete().eq('id', confessionId);
      // Delete related reports
      await supabase.from('reports').delete().eq('confession_id', confessionId);
      // Reload
      await loadReports();
      await loadConfessions();
      alert('Confession deleted.');
    }
  }

  async function ignoreReport(reportId) {
    await supabase.from('reports').delete().eq('id', reportId);
    await loadReports();
  }

  function getButtonStyle(confessionId, type) {
    const currentVote = userVotes[confessionId];
    if (currentVote === type) {
      return { background: '#4CAF50', color: 'white', border: 'none', padding: '5px 10px', borderRadius: 5, cursor: 'pointer' };
    }
    return { background: 'none', border: 'none', fontSize: 16, cursor: 'pointer' };
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ textAlign: 'center' }}>🤫 Anonymous Confessions</h1>
      
      <select
        value={selectedUniversity}
        onChange={(e) => setSelectedUniversity(e.target.value)}
        style={{ width: '100%', padding: 10, marginBottom: 20, fontSize: 16, borderRadius: 8 }}
      >
        {universities.map(u => (
          <option key={u.id} value={u.name}>{u.name}</option>
        ))}
      </select>

      <p style={{ textAlign: 'center', color: '#666' }}>Posting as: <strong>{anonymousName}</strong></p>
      
      <div style={{ background: '#f5f5f5', padding: 20, borderRadius: 10, marginBottom: 20 }}>
        <textarea
          placeholder="What's on your mind? (100% anonymous)..."
          value={newConfession}
          onChange={(e) => setNewConfession(e.target.value)}
          style={{ width: '100%', height: 100, padding: 10, fontSize: 16, borderRadius: 8, border: '1px solid #ccc', marginBottom: 10 }}
        />
        <button 
          onClick={postConfession}
          style={{ width: '100%', padding: 12, background: 'black', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer' }}
        >
          Post Confession
        </button>
      </div>

      {loading && <p style={{ textAlign: 'center' }}>Loading...</p>}

      {!loading && confessions.length === 0 && (
        <p style={{ textAlign: 'center', color: '#999' }}>No confessions yet. Be the first! 👆</p>
      )}

      {confessions.map((conf, index) => (
        <div key={conf.id} style={{ borderBottom: '1px solid #eee', padding: 15, marginBottom: 10 }}>
          <p style={{ fontSize: 18, margin: '0 0 10px 0' }}>{conf.content}</p>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => vote(conf.id, 'up')} style={getButtonStyle(conf.id, 'up')}>
              👍 {conf.upvotes || 0}
            </button>
            <button onClick={() => vote(conf.id, 'down')} style={getButtonStyle(conf.id, 'down')}>
              👎 {conf.downvotes || 0}
            </button>
            <button onClick={() => reportConfession(conf.id)} style={{ background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', color: '#999' }}>
              🚩 Report
            </button>
            <small style={{ color: '#999' }}>{new Date(conf.created_at).toLocaleString()}</small>
          </div>
          
          {!isPremium && (index + 1) % 3 === 0 && (
            <div style={{ margin: '15px 0 0 0', padding: 10, background: '#f9f9f9', textAlign: 'center', borderRadius: 8 }}>
              <small style={{ color: '#999' }}>Advertisement</small>
            </div>
          )}
        </div>
      ))}

      {/* KO-FI DONATION SECTION - YOUR LINK IS ACTIVE */}
      <div style={{ textAlign: 'center', marginTop: 40, padding: 20, background: '#f9f9f9', borderRadius: 10 }}>
        <p>❤️ Enjoying the app? Support the creator:</p>
        <a href="https://ko-fi.com/samuel67444" target="_blank" rel="noopener noreferrer">
          <button style={{ padding: '10px 20px', background: '#FF5E5B', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer' }}>
            ☕ Support on Ko-fi
          </button>
        </a>
      </div>

      {!isPremium && (
        <div style={{ textAlign: 'center', marginTop: 20, padding: 20, background: '#e3f2fd', borderRadius: 10 }}>
          <p>🚀 Upgrade to Premium - $3.99/month</p>
          <p style={{ fontSize: 14, color: '#666' }}>✓ No ads ✓ Custom name ✓ See who viewed</p>
          <button style={{ padding: '10px 20px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer' }}>
            Upgrade Now
          </button>
        </div>
      )}

      {/* Admin Login Button */}
      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <button 
          onClick={() => setShowAdmin(true)}
          style={{ padding: '5px 10px', background: '#333', color: 'white', border: 'none', borderRadius: 5, fontSize: 12, cursor: 'pointer' }}
        >
          🔒 Admin
        </button>
      </div>

      {/* Admin Panel Modal */}
      {showAdmin && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.9)', zIndex: 1000, overflow: 'auto', padding: 20 
        }}>
          <div style={{ maxWidth: 700, margin: '0 auto', background: 'white', padding: 20, borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2>Admin Panel</h2>
              <button onClick={() => {
                setShowAdmin(false);
                setIsAdminAuthenticated(false);
                setAdminPassword('');
              }} style={{ padding: '5px 15px', background: '#333', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
                Close
              </button>
            </div>

            {!isAdminAuthenticated ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <p>Enter admin password:</p>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  style={{ padding: 10, fontSize: 16, marginBottom: 10, width: '100%', maxWidth: 200 }}
                  onKeyPress={(e) => e.key === 'Enter' && adminLogin()}
                />
                <br />
                <button onClick={adminLogin} style={{ padding: '10px 20px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
                  Login
                </button>
                <p style={{ fontSize: 12, color: '#999', marginTop: 20 }}>Enter your admin password</p>
              </div>
            ) : (
              <>
                <h3>Reported Confessions</h3>
                {allReports.length === 0 && <p>No reports yet. ✅</p>}
                
                {allReports.map(report => (
                  <div key={report.id} style={{ border: '1px solid #ccc', margin: 15, padding: 15, borderRadius: 8, background: '#f9f9f9' }}>
                    <p><strong>📝 Confession:</strong></p>
                    <p style={{ background: 'white', padding: 10, borderRadius: 5 }}>{report.confessions?.content || '[Deleted]'}</p>
                    <p><strong>⚠️ Report Reason:</strong> {report.reason}</p>
                    <p><strong>📅 Reported:</strong> {new Date(report.created_at).toLocaleString()}</p>
                    <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                      <button 
                        onClick={() => deleteConfession(report.confession_id, report.id)} 
                        style={{ background: '#dc3545', color: 'white', padding: '8px 15px', border: 'none', borderRadius: 5, cursor: 'pointer' }}
                      >
                        🗑️ Delete Confession
                      </button>
                      <button 
                        onClick={() => ignoreReport(report.id)} 
                        style={{ background: '#6c757d', color: 'white', padding: '8px 15px', border: 'none', borderRadius: 5, cursor: 'pointer' }}
                      >
                        ✓ Ignore Report
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;