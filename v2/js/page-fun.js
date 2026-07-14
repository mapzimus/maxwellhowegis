// ===== FOR FUN PAGE CONTROLLER =====
// Shows fantastical/experimental projects (kind: "fun") and all games.
(function () {
    'use strict';
    var R = window.V2_RENDER;

    // Fun/experimental projects
    var funProjects = window.V2_DATA.projects.filter(function (p) { return p.kind === 'fun'; });
    R.renderGrid(
        document.getElementById('funGrid'),
        funProjects,
        { hrefFn: function (p) { return 'project.html?id=' + encodeURIComponent(p.slug); } }
    );

    // Games
    R.renderGrid(document.getElementById('gameGrid'), window.V2_DATA.games, {});
})();
