#include<iostream>
#include<vector>

using namespace std;

bool DeleteMin(vector<int> &nums,int &value){
	if(nums.size() == 0) return false;
	int pos = 0;
	for(int i = 0;i < nums.size();i++){
		if(value > nums[i]){
			value = nums[i];
			pos = i;
		} 
	} 
	nums[pos] = nums[nums.size() - 1];
	return true;
}

int main(){
	int n,value;
	cin >> n;
	vector<int> nums(n);
	for(int i = 0;i < n;i++) cin >> nums[i];
	value = nums[0];
	bool flag = DeleteMin(nums,value);
	if(flag) cout << "Yes" << " " << value;
	else cout << "No" ;
	return 0;
} 
