using UnityEditor;
using UnityEditor.SceneManagement;
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
}
