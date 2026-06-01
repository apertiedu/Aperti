// Inside TeacherRouter Switch, add these lines in the correct order:
<Route path="/content-craft" component={ContentCraft} />
<Route path="/class-forge" component={ClassForge} />
<Route path="/helpdesk" component={HelpDesk} />
<Route path="/pulse" component={Pulse} />
<Route path="/grade-flow" component={GradeFlow} />
<Route path="/scheme-craft" component={SchemeCraft} />
{isAdmin && (
  <>
    <Route path="/admin/helpdesk" component={HelpDeskAdmin} />
    <Route path="/admin/shield-core" component={ShieldCore} />
    <Route path="/admin/quick-switch" component={QuickSwitch} />
    <Route path="/admin/budget-sense" component={BudgetSense} />
    <Route path="/admin/auto-scale" component={AutoScale} />
    <Route path="/admin/spend-wise" component={SpendWise} />
    <Route path="/admin/paper-vault" component={PaperVaultAdmin} />
    <Route path="/admin/subpilot-settings" component={SubPilotAdmin} />
  </>
)}
<Route path="/ascend" component={Ascend} />
<Route path="/simverse" component={SimVerse} />
<Route path="/skill-badge" component={SkillBadge} />
<Route path="/learn-path" component={LearnPath} />
<Route path="/discover" component={DiscoverFeed} />
<Route path="/team-forge" component={TeamForge} />
<Route path="/privacy-vault" component={PrivacyVault} />
<Route path="/paper-vault" component={PaperVault} />
