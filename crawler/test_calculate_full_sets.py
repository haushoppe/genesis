import numpy as np
from calculate_full_sets import get_full_set_count

def test_two_full_rows_4x4():
    arr = np.zeros((4,4))
    arr[0, :] = 1
    arr[1, :] = 1
    assert get_full_set_count(arr) == 2

def test_two_full_columns_4x4():
    arr = np.zeros((4,4))
    arr[:, 0] = 1
    arr[:, 1] = 1
    assert get_full_set_count(arr) == 2

def test_columns_on_each_edge_4x4():
    arr = np.zeros((4,4))
    arr[:, 0] = 1
    arr[:, 3] = 1
    assert get_full_set_count(arr) == 2

def test_no_full_sets_4x4():
    arr = np.zeros((4,4))
    assert get_full_set_count(arr) == 0

def test_no_full_sets_but_individual_cells_4x4():
    arr = np.zeros((4,4))
    arr[0,2] = 1
    arr[1,3] = 1
    arr[3,0] = 1
    assert get_full_set_count(arr) == 0

def test_all_full_sets_4x4():
    arr = np.ones((4,4))
    assert get_full_set_count(arr) == 4

def test_two_full_rows_4x5():
    arr = np.zeros((4,5))
    arr[0, :] = 1
    arr[1, :] = 1
    assert get_full_set_count(arr) == 2

def test_two_full_rows_5x4():
    arr = np.zeros((5,4))
    arr[0, :] = 1
    arr[1, :] = 1
    assert get_full_set_count(arr) == 2

def test_two_full_columns_4x5():
    arr = np.zeros((4,5))
    arr[:, 0] = 1
    arr[:, 1] = 1
    assert get_full_set_count(arr) == 2

def test_two_full_columns_5x4():
    arr = np.zeros((5,4))
    arr[:, 0] = 1
    arr[:, 1] = 1
    assert get_full_set_count(arr) == 2

def test_columns_on_each_edge_4x5():
    arr = np.zeros((4,5))
    arr[:, 0] = 1
    arr[:, 4] = 1
    assert get_full_set_count(arr) == 2

def test_columns_on_each_edge_5x4():
    arr = np.zeros((5,4))
    arr[:, 0] = 1
    arr[:, 3] = 1
    assert get_full_set_count(arr) == 2

def test_no_full_sets_4x5():
    arr = np.zeros((4,5))
    assert get_full_set_count(arr) == 0

def test_no_full_sets_only_individual_cells_4x5():
    arr = np.zeros((4,5))
    arr[0,2] = 1
    arr[1,3] = 1
    arr[3,0] = 1
    assert get_full_set_count(arr) == 0

def test_all_full_sets_4x5():
    arr = np.ones((4,5))
    assert get_full_set_count(arr) == 5

def test_all_full_sets_5x4():
    arr = np.ones((5,4))
    assert get_full_set_count(arr) == 5

def test_sets_not_starting_in_first_row_5x4():
    arr = np.array(
    [[1, 0, 1, 0],
     [0, 1, 1, 1],
     [0, 1, 0, 1],
     [0, 1, 1, 1],
     [0, 1, 1, 1]])
    assert get_full_set_count(arr) == 2

def test_overlapping_in_fifth_tile_5x4():
    arr = np.array(
    [[0, 0, 0, 1],
     [0, 0, 0, 1],
     [0, 0, 0, 1],
     [0, 0, 0, 1],
     [1, 1, 1, 1]])
    assert get_full_set_count(arr) == 2

def test_several_overlapping_sets_5x4():
    arr = np.array(
    [[1, 0, 1, 1],
     [0, 1, 1, 1],
     [0, 1, 0, 1],
     [0, 1, 1, 1],
     [1, 1, 1, 1]])
    assert get_full_set_count(arr) == 2

def test_several_overlapping_sets_worse_5x4():
    arr = np.array(
    [[1, 1, 1, 1],
     [0, 1, 1, 1],
     [0, 1, 0, 1],
     [0, 1, 1, 1],
     [1, 1, 1, 1]])
    assert get_full_set_count(arr) == 3
