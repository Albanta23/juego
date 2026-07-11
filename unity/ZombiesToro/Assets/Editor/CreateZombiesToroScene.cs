using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEditor.Build.Reporting;
using UnityEngine;

public static class CreateZombiesToroScene
{
    private const string ScenePath = "Assets/ZombiesToro.unity";

    [MenuItem("Tools/Zombies Toro/Create Scene")]
    public static void CreateScene()
    {
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        var game = new GameObject("Zombies Toro Game");
        game.AddComponent<ZombiesToroGame>();
        EditorSceneManager.SaveScene(scene, ScenePath);
        Selection.activeGameObject = game;
    }

    [MenuItem("Tools/Zombies Toro/Build WebGL")]
    public static void BuildWebGL()
    {
        if (!System.IO.File.Exists(ScenePath)) CreateScene();

        PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
        PlayerSettings.stripEngineCode = false;
        var options = new BuildPlayerOptions
        {
            scenes = new[] { ScenePath },
            locationPathName = "../../web/unity/zombiestoro",
            target = BuildTarget.WebGL,
            options = BuildOptions.None
        };
        BuildReport report = BuildPipeline.BuildPlayer(options);
        Debug.Log("Zombies Toro build result: " + report.summary.result + " (" + report.summary.totalSize + " bytes)");
        if (Application.isBatchMode)
            EditorApplication.Exit(report.summary.result == BuildResult.Succeeded ? 0 : 1);
    }
}
