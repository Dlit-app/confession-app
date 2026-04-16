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
  const [selectedUniversity, setSelectedUniversity] = useState('');
  const [userVotes, setUserVotes] = useState({});
  
  // Admin panel states
  const [showAdmin, setShowAdmin] = useState(false);
  const [allReports, setAllReports] = useState([]);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  const userId = getUserId();

  // NIGERIAN UNIVERSITIES
  const universities = [
    { id: 1, name: 'University of Lagos (UNILAG)', location: 'Lagos' },
    { id: 2, name: 'University of Ibadan (UI)', location: 'Ibadan' },
    { id: 3, name: 'Obafemi Awolowo University (OAU)', location: 'Ile-Ife' },
    { id: 4, name: 'University of Nigeria, Nsukka (UNN)', location: 'Nsukka' },
    { id: 5, name: 'Ahmadu Bello University (ABU)', location: 'Zaria' },
    { id: 6, name: 'University of Benin (UNIBEN)', location: 'Benin City' },
    { id: 7, name: 'Lagos State University (LASU)', location: 'Lagos' },
    { id: 8, name: 'Covenant University', location: 'Ota' },
    { id: 9, name: 'Babcock University', location: 'Ilishan-Remo' },
    { id: 10, name: 'University of Ilorin (UNILORIN)', location: 'Ilorin' },
    { id: 11, name: 'Federal University of Technology, Minna', location: 'Minna' },
    { id: 12, name: 'University of Port Harcourt (UNIPORT)', location: 'Port Harcourt' },
    { id: 13, name: 'Nnamdi Azikiwe University (UNIZIK)', location: 'Awka' },
    { id: 14, name: 'Bayero University Kano (BUK)', location: 'Kano' },
    { id: 15, name: 'University of Abuja', location: 'Abuja' }
  ];

  useEffect(() => {
    // Set default university
    setSelectedUniversity('University of Lagos (UNILAG)');
    loadConfessions();
    const names = ['Quiet Panda', 'Loud Llama', 'Sleepy Sloth', 'Angry Cat', 'Happy Fox', 'Mysterious Owl', 'Silent Wolf', 'Mysterious Stranger', 'Silent Observer'];
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
      alert('Write something first!');
      return;
    }

    // Profanity filter
    const badWords = ['fuck', 'shit', 'asshole', 'bitch', 'cunt', 'nigger', 'faggot', 'stupid', 'idiot'];
    const lowerContent = newConfession.toLowerCase();
    for (let word of badWords) {
      if (lowerContent.includes(word)) {
        alert('Please keep it respectful. No hate speech or bullying.');
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
    
    if (currentVote === voteType) {
      await supabase
        .from('votes')
        .delete()
        .eq('confession_id', confessionId)
        .eq('user_id', userId);
      
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
      
      const newVotes = { ...userVotes };
      delete newVotes[confessionId];
      setUserVotes(newVotes);
    }
    else {
      if (currentVote) {
        await supabase
          .from('votes')
          .delete()
          .eq('confession_id', confessionId)
          .eq('user_id', userId);
      }
      
      await supabase
        .from('votes')
        .insert([{ confession_id: confessionId, user_id: userId, vote_type: voteType }]);
      
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
      
      setUserVotes({ ...userVotes, [confessionId]: voteType });
    }
    
    loadConfessions();
  }

  async function reportConfession(id) {
    const reason = prompt('Why are you reporting this confession?\n\n(Example: "Bullying", "Hate speech", "Spam", "False info")');
    if (reason && reason.trim()) {
      const { error } = await supabase.from('reports').insert([{ 
        confession_id: id, 
        reason: reason 
      }]);
      
      if (error) {
        alert('Error reporting: ' + error.message);
      } else {
        alert('Thank you for reporting. We will review it.');
      }
    }
  }

  async function adminLogin() {
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
      await supabase.from('confessions').delete().eq('id', confessionId);
      await supabase.from('reports').delete().eq('confession_id', confessionId);
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
      <h1 style={{ textAlign: 'center' }}>🤫 Naija Anonymous Confessions</h1>
      <p style={{ textAlign: 'center', color: '#666', fontSize: 14 }}>Speak your mind. No one knows it's you.</p>
      
      <select
        value={selectedUniversity}
        onChange={(e) => setSelectedUniversity(e.target.value)}
        style={{ width: '100%', padding: 10, marginBottom: 20, fontSize: 16, borderRadius: 8 }}
      >
        {universities.map(u => (
          <option key={u.id} value={u.name}>{u.name} ({u.location})</option>
        ))}
      </select>

      <p style={{ textAlign: 'center', color: '#666' }}>Posting as: <strong>{anonymousName}</strong></p>
      
      <div style={{ background: '#f5f5f5', padding: 20, borderRadius: 10, marginBottom: 20 }}>
        <textarea
          placeholder="What's on your mind? Spill the tea... ☕ (100% anonymous)"
          value={newConfession}
          onChange={(e) => setNewConfession(e.target.value)}
          style={{ width: '100%', height: 100, padding: 10, fontSize: 16, borderRadius: 8, border: '1px solid #ccc', marginBottom: 10 }}
        />
        <button 
          onClick={postConfession}
          style={{ width: '100%', padding: 12, background: '#008000', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer' }}
        >
          Post Confession
        </button>
      </div>

      {loading && <p style={{ textAlign: 'center' }}>Loading confessions...</p>}

      {!loading && confessions.length === 0 && (
        <p style={{ textAlign: 'center', color: '#999' }}>No confessions yet. Be the first to spill the tea! 👆</p>
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
        </div>
      ))}

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
                <p style={{ fontSize: 12, color: '#999', marginTop: 20 }}>Enter admin password</p>
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