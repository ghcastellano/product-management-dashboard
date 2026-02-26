import { useState, useEffect } from 'react';
import JiraConnection from './components/JiraConnection';
import TeamSelector from './components/TeamSelector';
import Dashboard from './components/Dashboard';
import ProductManagement from './components/ProductManagement';

const STORAGE_KEY_JIRA_URL = 'product-dashboard-jira-url';
const STORAGE_KEY_EMAIL = 'product-dashboard-email';
const STORAGE_KEY_TOKEN = 'product-dashboard-api-token';
const STORAGE_KEY_BOARDS = 'product-dashboard-selected-boards';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState('connection');
  const [credentials, setCredentials] = useState(null);
  const [selectedBoards, setSelectedBoards] = useState([]);
  const [savedBoardsFromHistory, setSavedBoardsFromHistory] = useState([]);
  const [activeSection, setActiveSection] = useState('product');
  const [newlyAddedBoard, setNewlyAddedBoard] = useState(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    let boardsFromHistory = [];
    try {
      const historyResponse = await fetch(`${API_URL}/history/boards`);
      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        if (historyData.success && historyData.boards?.length > 0) {
          boardsFromHistory = historyData.boards.map(b => ({
            id: b.board_id,
            name: b.board_name
          }));
          setSavedBoardsFromHistory(boardsFromHistory);
        }
      }
    } catch (err) {
      console.error('Failed to check database:', err);
    }

    // Try auto-login with saved credentials from localStorage
    try {
      const savedUrl = localStorage.getItem(STORAGE_KEY_JIRA_URL);
      const savedEmail = localStorage.getItem(STORAGE_KEY_EMAIL);
      const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);

      if (savedUrl && savedEmail && savedToken) {
        const response = await fetch(`${API_URL}/jira/test-connection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jiraUrl: savedUrl, email: savedEmail, apiToken: savedToken })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            const creds = { jiraUrl: savedUrl, email: savedEmail, apiToken: savedToken };
            setCredentials(creds);

            if (boardsFromHistory.length > 0) {
              setSelectedBoards(boardsFromHistory);
              setStep('dashboard');
            } else {
              setStep('teamSelection');
            }
            setIsLoading(false);
            return;
          }
        }
        localStorage.removeItem(STORAGE_KEY_TOKEN);
      }
    } catch (err) {
      console.error('Auto-login failed:', err);
    }

    setStep('connection');
    setIsLoading(false);
  };

  const handleConnectionSuccess = (creds) => {
    try {
      localStorage.setItem(STORAGE_KEY_JIRA_URL, creds.jiraUrl);
      localStorage.setItem(STORAGE_KEY_EMAIL, creds.email);
      localStorage.setItem(STORAGE_KEY_TOKEN, creds.apiToken);
    } catch (err) {
      console.error('Failed to save credentials:', err);
    }

    setCredentials(creds);

    if (savedBoardsFromHistory.length > 0) {
      setSelectedBoards(savedBoardsFromHistory);
      setStep('dashboard');
    } else {
      setStep('teamSelection');
    }
  };

  const handleTeamsSelected = (newBoards) => {
    const existingIds = new Set(selectedBoards.map(b => typeof b === 'object' ? b.id : b));
    const merged = [...selectedBoards];
    for (const board of newBoards) {
      const id = typeof board === 'object' ? board.id : board;
      if (!existingIds.has(id)) {
        merged.push(board);
      }
    }

    try {
      localStorage.setItem(STORAGE_KEY_BOARDS, JSON.stringify(merged));
    } catch (err) {
      console.error('Failed to save boards:', err);
    }

    setSelectedBoards(merged);
    if (newBoards.length > 0) {
      setNewlyAddedBoard(newBoards[0]);
    }
    setStep('dashboard');
  };

  const handleBoardDeleted = (boardId) => {
    setSelectedBoards(prev => prev.filter(b => {
      const id = typeof b === 'object' ? b.id : b;
      return id !== boardId;
    }));
    setSavedBoardsFromHistory(prev => prev.filter(b => b.id !== boardId));
    try {
      const updated = selectedBoards.filter(b => {
        const id = typeof b === 'object' ? b.id : b;
        return id !== boardId;
      });
      localStorage.setItem(STORAGE_KEY_BOARDS, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to update saved boards:', err);
    }
  };

  const handleReset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_BOARDS);
    } catch (err) {
      console.error('Failed to clear saved data:', err);
    }

    setStep('connection');
    setCredentials(null);
    setSelectedBoards([]);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Product Management Dashboard</h1>
            <p className="text-sm text-gray-600">Team metrics, epic intelligence & portfolio</p>
          </div>

          {step === 'dashboard' && credentials && (
            <div className="flex gap-3">
              <button
                onClick={() => setStep('teamSelection')}
                className="btn-secondary"
              >
                Add New Board
              </button>
            </div>
          )}
        </div>
        {step === 'dashboard' && (
          <div className="max-w-7xl mx-auto px-6 pb-4">
          <nav className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveSection('team')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeSection === 'team'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Team Metrics
            </button>
            <button
              onClick={() => setActiveSection('product')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeSection === 'product'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Product Management
            </button>
          </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className={step === 'dashboard' ? 'py-4' : 'py-8'}>
        {step === 'connection' && (
          <JiraConnection onConnectionSuccess={handleConnectionSuccess} />
        )}

        {step === 'teamSelection' && (
          <TeamSelector
            credentials={credentials}
            onTeamsSelected={handleTeamsSelected}
            existingBoards={selectedBoards}
            onBack={selectedBoards.length > 0 ? () => setStep('dashboard') : null}
          />
        )}

        {step === 'dashboard' && activeSection === 'team' && (
          <Dashboard
            credentials={credentials}
            selectedBoards={selectedBoards}
            newlyAddedBoard={newlyAddedBoard}
            onNewBoardHandled={() => setNewlyAddedBoard(null)}
            onBoardDeleted={handleBoardDeleted}
          />
        )}

        {step === 'dashboard' && activeSection === 'product' && (
          <ProductManagement
            credentials={credentials}
            selectedBoards={selectedBoards}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-4 text-center text-sm text-gray-600">
          <p>Product Management Dashboard v1.0 | Built with React + Chart.js</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
