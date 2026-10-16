import TeamMemberAIAssistant from '../../components/TeamMemberAIAssistant';

function MemberAIAssistantPage() {
  return (
    <div className="tf-page-container">
      <div className="tf-page-header">
        <div>
          <h2>Chat with AI</h2>
          <p>Ask about your assigned tasks, requirements, deadlines, progress, and attachments.</p>
        </div>
      </div>
      <TeamMemberAIAssistant inline />
    </div>
  );
}

export default MemberAIAssistantPage;
