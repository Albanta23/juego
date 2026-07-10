using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEditor.Build.Reporting;
using UnityEngine;

public static class CreateNeonMazeScene
{
    [MenuItem("Tools/Neon Maze/Create Scene")]
    public static void CreateScene()
    {
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        var game = new GameObject("Neon Maze Game");
        game.AddComponent<NeonMazeGame>();
        EditorSceneManager.SaveScene(scene, "Assets/NeonMaze.unity");
        Selection.activeGameObject = game;
    }

    [MenuItem("Tools/Neon Maze/Build WebGL")]
    public static void BuildWebGL()
    {
        const string scenePath = "Assets/NeonMaze.unity";
        if (!System.IO.File.Exists(scenePath)) CreateScene();

        // Keep the export compatible with static hosts that do not set gzip headers.
        PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;

        var options = new BuildPlayerOptions
        {
            scenes = new[] { scenePath },
            locationPathName = "../../web/unity/neonmaze",
            target = BuildTarget.WebGL,
            options = BuildOptions.None
        };
        BuildReport report = BuildPipeline.BuildPlayer(options);
        Debug.Log("Neon Maze build result: " + report.summary.result + " (" + report.summary.totalSize + " bytes)");
        EditorApplication.Exit(report.summary.result == BuildResult.Succeeded ? 0 : 1);
    }
}
