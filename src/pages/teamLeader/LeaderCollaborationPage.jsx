import { useState } from 'react';
import SharedTaskWorkspace from '../common/SharedTaskWorkspace';
import ProjectImportPanel from './ProjectImportPanel';

function LeaderCollaborationPage() {
  const [activeTask, setActiveTask] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);

  return (
    <div className="tf-page-container">
      <div className="tf-page-header">
        <div>
          <h2>Team Collaboration</h2>
          <p>Import, organize, assign, and review department projects in one shared workspace.</p>
        </div>
      </div>
      {activeTask ? (
        <SharedTaskWorkspace
          task={activeTask}
          role="team_leader"
          onClose={() => setActiveTask(null)}
          onUpdated={() => setRefreshToken((value) => value + 1)}
        />
      ) : (
        <ProjectImportPanel
          onOpenTask={setActiveTask}
          onPublished={() => setRefreshToken((value) => value + 1)}
          refreshToken={refreshToken}
        />
      )}
    </div>
  );
}

export default LeaderCollaborationPage;
