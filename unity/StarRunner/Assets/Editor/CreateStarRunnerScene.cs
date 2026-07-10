using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEditor.Build.Reporting;
using UnityEngine;

public static class CreateStarRunnerScene
{
    [MenuItem("Tools/Star Runner/Create Scene")]
    public static void CreateScene()
    {
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        var game = new GameObject("Star Runner Game");
        game.AddComponent<StarRunnerGame>();
        EditorSceneManager.SaveScene(scene, "Assets/StarRunner.unity");
        Selection.activeGameObject = game;
    }

    [MenuItem("Tools/Star Runner/Build WebGL")]
    public static void BuildWebGL()
    {
        const string scenePath = "Assets/StarRunner.unity";
        if (!System.IO.File.Exists(scenePath)) CreateScene();

        PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
        var options = new BuildPlayerOptions
        {
            scenes = new[] { scenePath },
            locationPathName = "../../web/unity/starrunner",
            target = BuildTarget.WebGL,
            options = BuildOptions.None
        };
        BuildReport report = BuildPipeline.BuildPlayer(options);
        Debug.Log("Star Runner build result: " + report.summary.result + " (" + report.summary.totalSize + " bytes)");
        if (Application.isBatchMode)
            EditorApplication.Exit(report.summary.result == BuildResult.Succeeded ? 0 : 1);
    }
}
