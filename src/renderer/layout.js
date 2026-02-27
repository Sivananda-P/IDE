document.addEventListener('DOMContentLoaded', () => {
    const activityItems = document.querySelectorAll('.activity-item');
    const sideViews = document.querySelectorAll('.side-view');
    const chatSidebar = document.getElementById('chat-sidebar');

    function switchView(viewId) {
        if (viewId === 'ai') {
            const isActive = chatSidebar.classList.toggle('active');
            const aiItem = document.querySelector(`.activity-item[data-view="ai"]`);
            if (aiItem) aiItem.classList.toggle('active', isActive);
            return;
        }

        // Reset all left sidebar views
        activityItems.forEach(item => {
            if (item.getAttribute('data-view') !== 'ai') {
                item.classList.remove('active');
            }
        });
        sideViews.forEach(view => view.classList.remove('active'));

        // Set active activity item (Explorer, Search, Git)
        const activeItem = document.querySelector(`.activity-item[data-view="${viewId}"]`);
        if (activeItem) activeItem.classList.add('active');

        // Set active view in left sidebar
        const activeView = document.getElementById(`view-${viewId}`);
        if (activeView) activeView.classList.add('active');
    }

    activityItems.forEach(item => {
        item.addEventListener('click', () => {
            const viewId = item.getAttribute('data-view');
            switchView(viewId);
        });
    });

    // Default to explorer
    switchView('explorer');
});
